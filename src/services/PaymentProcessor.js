const Transaction = require('../models/Transaction');

class PaymentProcessor {
  constructor() {
    this.paymentSources = new Map();
    this.categoryRules = new Map();
    this.setupDefaultCategories();
  }

  setupDefaultCategories() {
    // 瑞士超市和日用品
    this.categoryRules.set(/migros|coop|denner|aldi|lidl|manor|jumbo|volg|spar|landi/i, '超市购物');
    this.categoryRules.set(/apotheke|pharmacy|pharmacie|farmacia|drogerie/i, '医疗健康');
    
    // 交通出行 - 瑞士特有
    this.categoryRules.set(/sbb|cff|ffs|sncf|db|bahn|train|zug/i, '交通出行');
    this.categoryRules.set(/uber|taxi|bolt|zvv|tpg|vbl|bvb|transport/i, '交通出行');
    this.categoryRules.set(/parking|parkplatz|garage|station.service|shell|bp|esso|migrol/i, '交通出行');
    
    // 餐饮
    this.categoryRules.set(/restaurant|cafe|coffee|starbucks|mcdonald|kfc|burger.king|subway/i, '餐饮');
    this.categoryRules.set(/pizzeria|bistro|brasserie|bakery|boulangerie|confiserie/i, '餐饮');
    this.categoryRules.set(/bar|pub|club|lounge|taverne/i, '餐饮');
    
    // 娱乐
    this.categoryRules.set(/cinema|kino|movie|film|theater|theatre/i, '娱乐');
    this.categoryRules.set(/spotify|netflix|apple.music|youtube|gaming|steam/i, '娱乐');
    this.categoryRules.set(/gym|fitness|sport|swimming|spa|wellness/i, '健身娱乐');
    
    // 服装和美容
    this.categoryRules.set(/h&m|zara|uniqlo|nike|adidas|fashion|clothes|mode/i, '服装时尚');
    this.categoryRules.set(/coiffeur|hairdresser|beauty|cosmetic|parfum/i, '美容护理');
    
    // 教育和书籍
    this.categoryRules.set(/book|livre|buch|library|university|school|education/i, '教育书籍');
    
    // 医疗
    this.categoryRules.set(/hospital|hopital|spital|doctor|dentist|medical|clinic/i, '医疗健康');
    
    // 住房相关
    this.categoryRules.set(/rent|loyer|miete|utility|electric|gas|water|internet|swisscom/i, '住房水电');
    
    // 银行和金融
    this.categoryRules.set(/bank|banque|ubs|credit.suisse|raiffeisen|postfinance|revolut/i, '银行手续费');
    
    // 在线购物
    this.categoryRules.set(/amazon|ebay|zalando|digitec|galaxus|online|shop/i, '网购');
    
    // 政府和保险
    this.categoryRules.set(/insurance|assurance|tax|impot|government|commune|canton/i, '保险税费');
  }

  // 处理Apple Pay交易通知
  processApplePayTransaction(transactionData) {
    try {
      // 只处理成功的交易
      if (transactionData.status && transactionData.status !== 'success') {
        return {
          success: false,
          error: '交易未成功，不予记录'
        };
      }

      const category = this.categorizeTransaction(transactionData.merchant);
      const currency = transactionData.currency || 'EUR';
      
      const transaction = new Transaction(
        this.generateId(),
        transactionData.amount,
        category,
        `Apple Pay - ${transactionData.merchant}`,
        transactionData.date || new Date().toISOString(),
        'expense',
        currency
      );
      
      // 设置汇率
      const exchangeRates = {
        'EUR': 1,
        'CHF': 0.95,
        'USD': 0.85,
        'CNY': 0.13
      };
      
      if (exchangeRates[currency]) {
        transaction.setExchangeRate(exchangeRates[currency]);
      }
      
      return {
        success: true,
        transaction: transaction,
        source: 'Apple Pay'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 模拟处理LCL银行卡交易
  processLCLBankTransaction(transactionData) {
    try {
      const category = this.categorizeTransaction(transactionData.description);
      const currency = transactionData.currency || 'EUR';
      
      const transaction = new Transaction(
        this.generateId(),
        Math.abs(transactionData.amount), // 确保金额为正数
        category,
        `LCL银行卡 - ${transactionData.description}`,
        transactionData.date || new Date().toISOString(),
        transactionData.amount > 0 ? 'income' : 'expense',
        currency
      );
      
      // 设置汇率（实际应用中应该从汇率API获取）
      const exchangeRates = {
        'EUR': 1,
        'CHF': 0.95, // 1 CHF = 0.95 EUR (示例汇率)
        'USD': 0.85, // 1 USD = 0.85 EUR (示例汇率)
        'CNY': 0.13  // 1 CNY = 0.13 EUR (示例汇率)
      };
      
      if (exchangeRates[currency]) {
        transaction.setExchangeRate(exchangeRates[currency]);
      }
      
      return {
        success: true,
        transaction: transaction,
        source: 'LCL银行卡'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // 根据商户名称或描述自动分类
  categorizeTransaction(merchantOrDescription) {
    const text = merchantOrDescription.toLowerCase();
    
    for (const [pattern, category] of this.categoryRules) {
      if (pattern.test(text)) {
        return category;
      }
    }
    
    return '其他'; // 默认分类
  }

  // 模拟银行短信解析
  parseBankSMS(smsContent) {
    // LCL银行短信格式示例: 
    // "LCL: 您的卡尾号1234于12月15日在CARREFOUR消费EUR 45.60"
    // "LCL: 您的卡尾号1234于12月15日在CARREFOUR消费CHF 45.60"
    const patterns = {
      lcl_eur: /LCL.*卡尾号\d+于(.+)在(.+)消费EUR\s*([\d.]+)/i,
      lcl_chf: /LCL.*卡尾号\d+于(.+)在(.+)消费CHF\s*([\d.]+)/i,
      lcl_usd: /LCL.*卡尾号\d+于(.+)在(.+)消费USD\s*([\d.]+)/i,
      // 通用格式，支持多种货币
      lcl_generic: /LCL.*卡尾号\d+于(.+)在(.+)消费([A-Z]{3})\s*([\d.]+)/i,
    };

    for (const [bank, pattern] of Object.entries(patterns)) {
      const match = smsContent.match(pattern);
      if (match) {
        let currency, amount;
        
        if (bank === 'lcl_generic') {
          currency = match[3];
          amount = parseFloat(match[4]);
        } else {
          currency = bank.split('_')[1].toUpperCase();
          amount = parseFloat(match[3]);
        }

        return {
          bank: 'LCL',
          date: match[1],
          merchant: match[2],
          amount: amount,
          currency: currency,
          rawText: smsContent
        };
      }
    }

    return null;
  }

  generateId() {
    return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  // 添加自定义分类规则
  addCategoryRule(pattern, category) {
    this.categoryRules.set(new RegExp(pattern, 'i'), category);
  }

  // 获取所有支付源的摘要
  getPaymentSourcesSummary() {
    return {
      applePay: {
        name: 'Apple Pay',
        description: '苹果支付自动同步',
        status: 'active'
      },
      lclBank: {
        name: 'LCL银行卡',
        description: '通过短信解析交易',
        status: 'active'
      }
    };
  }
}

module.exports = PaymentProcessor;