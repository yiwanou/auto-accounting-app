class CurrencyDetector {
  constructor() {
    this.currencyPatterns = new Map();
    this.setupCurrencyDetection();
  }

  setupCurrencyDetection() {
    // 货币符号和代码匹配
    this.currencyPatterns.set(/CHF|Fr\.|SFr|швейцарск/i, 'CHF');
    this.currencyPatterns.set(/EUR|€|euro/i, 'EUR');
    this.currencyPatterns.set(/USD|\$|dollar/i, 'USD');
    this.currencyPatterns.set(/CNY|¥|yuan|rmb/i, 'CNY');
    this.currencyPatterns.set(/GBP|£|pound/i, 'GBP');
    this.currencyPatterns.set(/JPY|¥|yen/i, 'JPY');
    
    // 地区和商户推断
    this.merchantCurrencyMap = new Map();
    
    // 瑞士商户 - CHF
    this.merchantCurrencyMap.set(/migros|coop|denner|sbb|cff|manor|jumbo|volg|swisscom/i, 'CHF');
    
    // 欧洲商户 - EUR
    this.merchantCurrencyMap.set(/sncf|db|lufthansa|airfrance|klm/i, 'EUR');
    
    // 美国商户 - USD
    this.merchantCurrencyMap.set(/amazon\.com|uber|starbucks|mcdonald|apple|google/i, 'USD');
    
    // 中国商户 - CNY
    this.merchantCurrencyMap.set(/alipay|wechat|taobao|tmall|jd\.com/i, 'CNY');
  }

  // 从文本中检测货币
  detectCurrencyFromText(text) {
    if (!text) return null;
    
    const normalizedText = text.toLowerCase();
    
    // 优先查找明确的货币符号
    for (const [pattern, currency] of this.currencyPatterns) {
      if (pattern.test(normalizedText)) {
        return currency;
      }
    }
    
    return null;
  }

  // 从商户名称推断货币
  detectCurrencyFromMerchant(merchantName) {
    if (!merchantName) return null;
    
    const normalizedMerchant = merchantName.toLowerCase();
    
    for (const [pattern, currency] of this.merchantCurrencyMap) {
      if (pattern.test(normalizedMerchant)) {
        return currency;
      }
    }
    
    return null;
  }

  // 从金额格式推断货币
  detectCurrencyFromAmount(amountText) {
    if (!amountText) return null;
    
    // 常见格式：CHF 25.50, €25.50, $25.50, ¥25.50
    const patterns = [
      { regex: /CHF\s*[\d.,]+|[\d.,]+\s*CHF/i, currency: 'CHF' },
      { regex: /€\s*[\d.,]+|[\d.,]+\s*€/i, currency: 'EUR' },
      { regex: /\$\s*[\d.,]+|[\d.,]+\s*\$/i, currency: 'USD' },
      { regex: /¥\s*[\d.,]+|[\d.,]+\s*¥/i, currency: 'CNY' },
      { regex: /£\s*[\d.,]+|[\d.,]+\s*£/i, currency: 'GBP' }
    ];
    
    for (const { regex, currency } of patterns) {
      if (regex.test(amountText)) {
        return currency;
      }
    }
    
    return null;
  }

  // 综合检测货币
  detectCurrency(transactionData) {
    const { text, merchant, amount, location } = transactionData;
    
    // 方法1: 从完整文本检测
    let currency = this.detectCurrencyFromText(text);
    if (currency) return currency;
    
    // 方法2: 从金额格式检测
    currency = this.detectCurrencyFromAmount(amount);
    if (currency) return currency;
    
    // 方法3: 从商户名称推断
    currency = this.detectCurrencyFromMerchant(merchant);
    if (currency) return currency;
    
    // 方法4: 从地理位置推断（如果有GPS信息）
    currency = this.detectCurrencyFromLocation(location);
    if (currency) return currency;
    
    // 默认根据最常用的商户类型
    return this.getDefaultCurrencyForMerchant(merchant);
  }

  // 根据地理位置推断货币
  detectCurrencyFromLocation(location) {
    if (!location) return null;
    
    const countryToCurrency = {
      'CH': 'CHF', 'Switzerland': 'CHF',
      'DE': 'EUR', 'FR': 'EUR', 'IT': 'EUR', 'ES': 'EUR', 'Austria': 'EUR',
      'US': 'USD', 'USA': 'USD',
      'CN': 'CNY', 'China': 'CNY',
      'GB': 'GBP', 'UK': 'GBP',
      'JP': 'JPY', 'Japan': 'JPY'
    };
    
    const locationStr = String(location).toUpperCase();
    
    for (const [country, currency] of Object.entries(countryToCurrency)) {
      if (locationStr.includes(country.toUpperCase())) {
        return currency;
      }
    }
    
    return null;
  }

  // 为商户类型提供默认货币
  getDefaultCurrencyForMerchant(merchant) {
    if (!merchant) return 'EUR'; // 默认欧元
    
    const merchantStr = merchant.toLowerCase();
    
    // 瑞士商户默认CHF
    if (/migros|coop|denner|sbb|manor|swisscom/.test(merchantStr)) {
      return 'CHF';
    }
    
    // 美国科技公司默认USD
    if (/apple|google|amazon|uber|netflix/.test(merchantStr)) {
      return 'USD';
    }
    
    return 'EUR'; // 其他情况默认EUR
  }

  // 解析包含货币信息的交易文本
  parseTransactionText(text) {
    if (!text) return null;
    
    // 匹配模式：[商户] [金额] [货币] [其他信息]
    const patterns = [
      // "MIGROS CHF 25.50" 格式
      /^(\w+.*?)\s+(CHF|EUR|USD|CNY|GBP|JPY)\s+([\d.,]+)$/i,
      // "SBB CFF FFS 12.40 CHF" 格式 (多词商户 金额 货币)
      /^(.+?)\s+([\d.,]+)\s+(CHF|EUR|USD|CNY|GBP|JPY)$/i,
      // "CHF 25.50 MIGROS" 格式
      /^(CHF|EUR|USD|CNY|GBP|JPY)\s+([\d.,]+)\s+(.+)$/i,
      // "25.50 CHF MIGROS" 格式
      /^([\d.,]+)\s+(CHF|EUR|USD|CNY|GBP|JPY)\s+(.+)$/i
    ];
    
    for (const pattern of patterns) {
      const match = text.match(pattern);
      if (match) {
        return this.extractTransactionInfo(match, pattern);
      }
    }
    
    return null;
  }

  extractTransactionInfo(match, pattern) {
    // 根据不同的模式提取信息
    const patternStr = pattern.toString();
    
    if (patternStr.includes('^(\\w+.*?)\\s+(CHF|EUR')) {
      // 模式1: 商户 货币 金额 (MIGROS CHF 25.50)
      return {
        merchant: match[1].trim(),
        currency: match[2].toUpperCase(),
        amount: parseFloat(match[3].replace(',', '.')),
        originalText: match[0]
      };
    } else if (patternStr.includes('^(.+?)\\s+([\\d.,]+)\\s+(CHF|EUR')) {
      // 模式2: 商户 金额 货币 (SBB CFF FFS 12.40 CHF)
      return {
        merchant: match[1].trim(),
        amount: parseFloat(match[2].replace(',', '.')),
        currency: match[3].toUpperCase(),
        originalText: match[0]
      };
    } else if (patternStr.includes('^(CHF|EUR.*?)\\s+([\\d.,]+)\\s+')) {
      // 模式3: 货币 金额 商户 (CHF 25.50 MIGROS)
      return {
        currency: match[1].toUpperCase(),
        amount: parseFloat(match[2].replace(',', '.')),
        merchant: match[3].trim(),
        originalText: match[0]
      };
    } else if (patternStr.includes('^([\\d.,]+)\\s+(CHF|EUR')) {
      // 模式4: 金额 货币 商户 (25.50 CHF MIGROS)
      return {
        amount: parseFloat(match[1].replace(',', '.')),
        currency: match[2].toUpperCase(),
        merchant: match[3].trim(),
        originalText: match[0]
      };
    }
    
    // 备用解析
    return {
      merchant: 'Unknown',
      amount: 0,
      currency: 'CHF',
      originalText: match[0]
    };
  }
}

module.exports = CurrencyDetector;