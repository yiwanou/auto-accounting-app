const CurrencyDetector = require('./CurrencyDetector');
const PaymentProcessor = require('./PaymentProcessor');
const Transaction = require('../models/Transaction');

class SmartApplePayProcessor extends PaymentProcessor {
  constructor() {
    super();
    this.currencyDetector = new CurrencyDetector();
    this.setupAdvancedRules();
  }

  setupAdvancedRules() {
    // 添加更智能的规则
    this.contextRules = new Map();
    
    // 时间段规则
    this.timeBasedRules = {
      morning: { start: 6, end: 11, categories: ['咖啡', '早餐', '通勤'] },
      lunch: { start: 11, end: 14, categories: ['午餐', '餐饮'] },
      afternoon: { start: 14, end: 17, categories: ['咖啡', '零食'] },
      evening: { start: 17, end: 22, categories: ['晚餐', '娱乐'] },
      night: { start: 22, end: 6, categories: ['夜宵', '娱乐', 'Uber'] }
    };
    
    // 金额规则
    this.amountBasedRules = {
      micro: { max: 5, likely: ['咖啡', '小费', '停车费'] },
      small: { min: 5, max: 20, likely: ['快餐', '交通', '小商品'] },
      medium: { min: 20, max: 100, likely: ['餐饮', '购物', '娱乐'] },
      large: { min: 100, max: 500, likely: ['大型购物', '住宿', '服装'] },
      huge: { min: 500, likely: ['电子产品', '家具', '旅行'] }
    };
  }

  // 智能处理Apple Pay交易
  async processSmartApplePayTransaction(rawData) {
    try {
      // 第一步：解析原始数据
      const parsedData = this.parseApplePayNotification(rawData);
      
      // 第二步：智能检测货币
      const currency = this.detectCurrency(parsedData);
      
      // 第三步：智能分类
      const category = this.smartCategorization(parsedData);
      
      // 第四步：生成智能描述
      const description = this.generateSmartDescription(parsedData);
      
      // 第五步：设置汇率
      const exchangeRate = await this.getExchangeRate(currency);
      
      // 创建交易对象
      const transaction = new Transaction(
        this.generateId(),
        parsedData.amount,
        category,
        description,
        parsedData.date || new Date().toISOString(),
        'expense',
        currency
      );
      
      transaction.setExchangeRate(exchangeRate);
      
      return {
        success: true,
        transaction: transaction,
        confidence: this.calculateConfidence(parsedData, category, currency),
        source: 'Smart Apple Pay',
        metadata: {
          originalData: rawData,
          parsedData: parsedData,
          detectedCurrency: currency,
          suggestedCategory: category
        }
      };
      
    } catch (error) {
      return {
        success: false,
        error: error.message,
        originalData: rawData
      };
    }
  }

  // 解析Apple Pay通知数据
  parseApplePayNotification(rawData) {
    // 这里模拟解析Apple Pay的通知数据
    // 实际情况下，Apple Pay会通过PassKit或其他方式提供交易信息
    
    let merchant, amount, currency, location, timestamp;
    
    if (typeof rawData === 'string') {
      // 尝试从文本中解析
      const currencyInfo = this.currencyDetector.parseTransactionText(rawData);
      if (currencyInfo) {
        merchant = currencyInfo.merchant;
        amount = currencyInfo.amount;
        currency = currencyInfo.currency;
      } else {
        // 备用解析
        const matches = rawData.match(/([\w\s]+?)\s*([\d.,]+)\s*([A-Z]{3})?/);
        if (matches) {
          merchant = matches[1]?.trim();
          amount = parseFloat(matches[2]?.replace(',', '.'));
          currency = matches[3];
        }
      }
    } else if (typeof rawData === 'object') {
      // 结构化数据
      merchant = rawData.merchant || rawData.merchantName || rawData.store;
      amount = rawData.amount || rawData.value;
      currency = rawData.currency || rawData.currencyCode;
      location = rawData.location;
      timestamp = rawData.timestamp || rawData.date;
    }
    
    return {
      merchant: merchant || 'Unknown Merchant',
      amount: amount || 0,
      currency: currency,
      location: location,
      timestamp: timestamp || new Date().toISOString(),
      hour: new Date().getHours(),
      fullText: typeof rawData === 'string' ? rawData : JSON.stringify(rawData)
    };
  }

  // 检测货币
  detectCurrency(parsedData) {
    // 使用专门的货币检测器
    const detected = this.currencyDetector.detectCurrency({
      text: parsedData.fullText,
      merchant: parsedData.merchant,
      amount: String(parsedData.amount),
      location: parsedData.location
    });
    
    return detected || parsedData.currency || 'CHF'; // 瑞士默认CHF
  }

  // 智能分类
  smartCategorization(parsedData) {
    const { merchant, amount, hour } = parsedData;
    
    // 第一优先级：商户名称精确匹配
    const merchantCategory = this.categorizeTransaction(merchant);
    if (merchantCategory !== '其他') {
      return merchantCategory;
    }
    
    // 第二优先级：时间 + 金额推断
    const timeCategory = this.getTimeBasedCategory(hour, amount);
    if (timeCategory) {
      return timeCategory;
    }
    
    // 第三优先级：金额范围推断
    const amountCategory = this.getAmountBasedCategory(amount);
    if (amountCategory) {
      return amountCategory;
    }
    
    // 第四优先级：智能推测
    return this.intelligentGuess(parsedData);
  }

  getTimeBasedCategory(hour, amount) {
    let currentPeriod;
    
    if (hour >= 6 && hour < 11) currentPeriod = 'morning';
    else if (hour >= 11 && hour < 14) currentPeriod = 'lunch';
    else if (hour >= 14 && hour < 17) currentPeriod = 'afternoon';
    else if (hour >= 17 && hour < 22) currentPeriod = 'evening';
    else currentPeriod = 'night';
    
    const rules = this.timeBasedRules[currentPeriod];
    if (rules && rules.categories) {
      // 根据金额选择最可能的类别
      if (amount < 10 && currentPeriod === 'morning') return '餐饮'; // 早餐/咖啡
      if (amount > 15 && amount < 50 && currentPeriod === 'lunch') return '餐饮'; // 午餐
      if (amount > 30 && currentPeriod === 'evening') return '餐饮'; // 晚餐
    }
    
    return null;
  }

  getAmountBasedCategory(amount) {
    for (const [range, rule] of Object.entries(this.amountBasedRules)) {
      if (this.isInAmountRange(amount, rule)) {
        return rule.likely[0]; // 返回最可能的第一个类别
      }
    }
    return null;
  }

  isInAmountRange(amount, rule) {
    if (rule.min !== undefined && amount < rule.min) return false;
    if (rule.max !== undefined && amount > rule.max) return false;
    return true;
  }

  intelligentGuess(parsedData) {
    const { merchant, amount } = parsedData;
    
    // 基于商户名称的模糊匹配
    const merchantLower = merchant.toLowerCase();
    
    if (merchantLower.includes('market') || merchantLower.includes('super')) return '超市购物';
    if (merchantLower.includes('gas') || merchantLower.includes('fuel')) return '交通出行';
    if (merchantLower.includes('hotel') || merchantLower.includes('booking')) return '住宿旅行';
    if (merchantLower.includes('online') || merchantLower.includes('web')) return '网购';
    
    // 基于金额的最终推测
    if (amount < 5) return '餐饮'; // 小额通常是咖啡等
    if (amount > 200) return '大额购物'; // 大额可能是重要购买
    
    return '其他';
  }

  // 生成智能描述
  generateSmartDescription(parsedData) {
    const { merchant, amount, currency, hour } = parsedData;
    
    // 时间描述
    let timeDesc = '';
    if (hour >= 6 && hour < 11) timeDesc = '早间';
    else if (hour >= 11 && hour < 14) timeDesc = '午间';
    else if (hour >= 17 && hour < 22) timeDesc = '晚间';
    
    // 生成描述
    const currencySymbol = this.getCurrencySymbol(currency);
    return `${timeDesc}在${merchant}的Apple Pay消费 ${currencySymbol}${amount}`;
  }

  getCurrencySymbol(currency) {
    const symbols = {
      'CHF': 'CHF ',
      'EUR': '€',
      'USD': '$',
      'CNY': '¥'
    };
    return symbols[currency] || currency + ' ';
  }

  // 获取实时汇率
  async getExchangeRate(currency) {
    // 这里应该调用实时汇率API
    // 目前使用静态汇率
    const rates = {
      'EUR': 1,
      'CHF': 0.95,
      'USD': 0.85,
      'CNY': 0.13
    };
    
    return rates[currency] || 1;
  }

  // 计算置信度
  calculateConfidence(parsedData, category, currency) {
    let confidence = 0;
    
    // 商户识别置信度
    if (parsedData.merchant && parsedData.merchant !== 'Unknown Merchant') {
      confidence += 30;
    }
    
    // 货币检测置信度
    if (currency && currency !== 'EUR') { // 非默认货币
      confidence += 25;
    }
    
    // 分类置信度
    if (category && category !== '其他') {
      confidence += 35;
    }
    
    // 金额合理性
    if (parsedData.amount > 0 && parsedData.amount < 10000) {
      confidence += 10;
    }
    
    return Math.min(confidence, 100);
  }

  // 学习用户习惯（机器学习功能）
  learnFromUser(transaction, userCorrection) {
    // 这里可以实现机器学习功能
    // 学习用户的分类偏好，提高准确性
    console.log(`学习: 用户将${transaction.description}修正为${userCorrection.category}`);
    
    // 可以存储到数据库，下次遇到类似商户时提高准确性
  }
}

module.exports = SmartApplePayProcessor;