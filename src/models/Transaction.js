class Transaction {
  constructor(id, amount, category, description, date, type = 'expense', currency = 'EUR') {
    this.id = id;
    this.amount = parseFloat(amount);
    this.category = category;
    this.description = description;
    this.date = date || new Date().toISOString();
    this.type = type; // 'income' or 'expense'
    this.currency = currency; // 支持多种货币：EUR, CHF, CNY, USD
    this.exchangeRate = 1; // 兑换汇率，默认为1
    this.amountInEUR = this.amount; // 换算为EUR的金额，用于统计
  }

  static validate(data) {
    const errors = [];
    
    if (!data.amount || isNaN(data.amount) || data.amount <= 0) {
      errors.push('金额必须是大于0的数字');
    }
    
    if (!data.category || data.category.trim() === '') {
      errors.push('类别不能为空');
    }
    
    if (!data.description || data.description.trim() === '') {
      errors.push('描述不能为空');
    }
    
    if (!['income', 'expense'].includes(data.type)) {
      errors.push('类型必须是收入或支出');
    }

    const supportedCurrencies = ['EUR', 'CHF', 'CNY', 'USD'];
    if (data.currency && !supportedCurrencies.includes(data.currency)) {
      errors.push('不支持的货币类型');
    }
    
    return errors;
  }

  // 设置汇率并计算EUR等值
  setExchangeRate(rate) {
    this.exchangeRate = rate;
    this.amountInEUR = this.amount * rate;
    return this;
  }

  // 格式化货币显示
  formatAmount(showOriginal = true) {
    const currencySymbols = {
      'EUR': '€',
      'CHF': 'CHF',
      'CNY': '¥',
      'USD': '$'
    };

    const symbol = currencySymbols[this.currency] || this.currency;
    const formattedAmount = this.amount.toFixed(2);

    if (showOriginal && this.currency !== 'EUR') {
      const eurAmount = this.amountInEUR.toFixed(2);
      return `${symbol}${formattedAmount} (€${eurAmount})`;
    }

    return `${symbol}${formattedAmount}`;
  }

  toJSON() {
    return {
      id: this.id,
      amount: this.amount,
      category: this.category,
      description: this.description,
      date: this.date,
      type: this.type,
      currency: this.currency,
      exchangeRate: this.exchangeRate,
      amountInEUR: this.amountInEUR,
      formattedAmount: this.formatAmount()
    };
  }
}

module.exports = Transaction;