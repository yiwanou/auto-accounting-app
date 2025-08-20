class AutoAccountingApp {
  constructor() {
    this.transactions = [];
    this.balance = { balance: 0, income: 0, expense: 0 };
    this.currentPage = 0;
    this.pageSize = 20;
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadBalance();
    this.loadTransactions();
    this.loadTodayStats();
    this.checkiOSEnvironment();
  }

  bindEvents() {
    // 快速操作按钮
    document.getElementById('add-expense-btn').addEventListener('click', () => {
      this.showTransactionModal('expense');
    });

    document.getElementById('add-income-btn').addEventListener('click', () => {
      this.showTransactionModal('income');
    });

    document.getElementById('scan-sms-btn').addEventListener('click', () => {
      this.showSMSModal();
    });

    // 加载更多按钮
    document.getElementById('load-more-btn').addEventListener('click', () => {
      this.loadMoreTransactions();
    });

    // iOS集成按钮
    document.getElementById('install-shortcuts-btn').addEventListener('click', () => {
      this.installShortcuts();
    });

    document.getElementById('add-to-homescreen-btn').addEventListener('click', () => {
      this.showInstallPrompt();
    });

    // 模态框关闭
    document.querySelectorAll('.close').forEach(closeBtn => {
      closeBtn.addEventListener('click', (e) => {
        e.target.closest('.modal').style.display = 'none';
      });
    });

    // 表单提交
    document.getElementById('transaction-form').addEventListener('submit', (e) => {
      this.handleTransactionSubmit(e);
    });

    document.getElementById('sms-form').addEventListener('submit', (e) => {
      this.handleSMSSubmit(e);
    });

    // 点击模态框外部关闭
    window.addEventListener('click', (e) => {
      if (e.target.classList.contains('modal')) {
        e.target.style.display = 'none';
      }
    });
  }

  async loadBalance() {
    try {
      const response = await fetch('/api/balance');
      const data = await response.json();
      
      if (data.success) {
        this.balance = data.data;
        this.updateBalanceDisplay();
      }
    } catch (error) {
      console.error('加载余额失败:', error);
    }
  }

  updateBalanceDisplay() {
    document.getElementById('balance-amount').textContent = `€${this.balance.balance.toFixed(2)}`;
  }

  async loadTransactions() {
    try {
      const response = await fetch(`/api/transactions?limit=${this.pageSize}&offset=${this.currentPage * this.pageSize}`);
      const data = await response.json();
      
      if (data.success) {
        if (this.currentPage === 0) {
          this.transactions = data.data;
        } else {
          this.transactions = [...this.transactions, ...data.data];
        }
        this.renderTransactions();
      }
    } catch (error) {
      console.error('加载交易记录失败:', error);
    }
  }

  async loadMoreTransactions() {
    this.currentPage++;
    await this.loadTransactions();
  }

  renderTransactions() {
    const container = document.getElementById('transactions-list');
    
    if (this.currentPage === 0) {
      container.innerHTML = '';
    }
    
    this.transactions.slice(this.currentPage * this.pageSize).forEach(transaction => {
      const element = this.createTransactionElement(transaction);
      container.appendChild(element);
    });
  }

  createTransactionElement(transaction) {
    const div = document.createElement('div');
    div.className = `transaction-item ${transaction.type}`;
    
    const currencySymbol = this.getCurrencySymbol(transaction.currency || 'EUR');
    const formattedAmount = `${currencySymbol}${transaction.amount.toFixed(2)}`;
    
    // 如果不是EUR，显示原始金额和EUR等值
    let displayAmount = formattedAmount;
    if (transaction.currency && transaction.currency !== 'EUR' && transaction.amount_in_eur) {
      displayAmount += ` (€${transaction.amount_in_eur.toFixed(2)})`;
    }
    
    div.innerHTML = `
      <div class="transaction-info">
        <div class="transaction-category">${this.getCategoryIcon(transaction.category)} ${transaction.category}</div>
        <div class="transaction-description">${transaction.description}</div>
        <div class="currency-info">${new Date(transaction.date).toLocaleDateString('zh-CN')}</div>
      </div>
      <div class="transaction-amount ${transaction.type}">
        ${transaction.type === 'expense' ? '-' : '+'}${displayAmount}
      </div>
    `;
    
    return div;
  }

  getCurrencySymbol(currency) {
    const symbols = {
      'EUR': '€',
      'CHF': 'CHF ',
      'USD': '$',
      'CNY': '¥'
    };
    return symbols[currency] || currency + ' ';
  }

  getCategoryIcon(category) {
    const icons = {
      '餐饮': '🍽️',
      '交通': '🚗',
      '娱乐': '🎮',
      '日用品': '🛒',
      '医疗': '❤️',
      '服装': '👕',
      '教育': '📚',
      '工资': '💰',
      '投资收益': '📈',
      '其他收入': '💵',
      '其他': '📁'
    };
    return icons[category] || '📁';
  }

  async loadTodayStats() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
      
      const response = await fetch(`/api/transactions?start_date=${today}&end_date=${tomorrow}`);
      const data = await response.json();
      
      if (data.success) {
        const todayTransactions = data.data;
        const income = todayTransactions
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + (t.amount_in_eur || t.amount), 0);
        
        const expense = todayTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + (t.amount_in_eur || t.amount), 0);
        
        document.getElementById('today-income').textContent = `€${income.toFixed(2)}`;
        document.getElementById('today-expense').textContent = `€${expense.toFixed(2)}`;
        document.getElementById('today-balance').textContent = `€${(income - expense).toFixed(2)}`;
      }
    } catch (error) {
      console.error('加载今日统计失败:', error);
    }
  }

  showTransactionModal(type) {
    const modal = document.getElementById('add-transaction-modal');
    const title = document.getElementById('modal-title');
    const typeInput = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    
    title.textContent = type === 'expense' ? '添加支出' : '添加收入';
    typeInput.value = type;
    
    // 更新分类选项
    if (type === 'income') {
      categorySelect.innerHTML = `
        <option value="工资">💰 工资</option>
        <option value="投资收益">📈 投资收益</option>
        <option value="其他收入">💵 其他收入</option>
      `;
    } else {
      categorySelect.innerHTML = `
        <option value="餐饮">🍽️ 餐饮</option>
        <option value="交通">🚗 交通</option>
        <option value="娱乐">🎮 娱乐</option>
        <option value="日用品">🛒 日用品</option>
        <option value="医疗">❤️ 医疗</option>
        <option value="服装">👕 服装</option>
        <option value="教育">📚 教育</option>
        <option value="其他">📁 其他</option>
      `;
    }
    
    // 设置默认日期
    document.getElementById('date').value = new Date().toISOString().split('T')[0];
    
    modal.style.display = 'block';
  }

  showSMSModal() {
    const modal = document.getElementById('sms-modal');
    modal.style.display = 'block';
  }

  async handleTransactionSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const transactionData = {
      amount: parseFloat(formData.get('amount')),
      category: formData.get('category'),
      description: formData.get('description'),
      date: formData.get('date'),
      type: formData.get('type'),
      currency: formData.get('currency') || 'EUR'
    };
    
    try {
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 关闭模态框
        document.getElementById('add-transaction-modal').style.display = 'none';
        
        // 清空表单
        e.target.reset();
        
        // 重新加载数据
        this.currentPage = 0;
        await this.loadBalance();
        await this.loadTransactions();
        await this.loadTodayStats();
        
        this.showNotification('交易记录添加成功', 'success');
      } else {
        this.showNotification(data.errors ? data.errors.join(', ') : '添加失败', 'error');
      }
    } catch (error) {
      console.error('添加交易记录失败:', error);
      this.showNotification('添加失败，请重试', 'error');
    }
  }

  async handleSMSSubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const smsData = {
      smsContent: formData.get('smsContent')
    };
    
    try {
      const response = await fetch('/api/sms/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(smsData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 关闭模态框
        document.getElementById('sms-modal').style.display = 'none';
        
        // 清空表单
        e.target.reset();
        
        // 重新加载数据
        this.currentPage = 0;
        await this.loadBalance();
        await this.loadTransactions();
        await this.loadTodayStats();
        
        this.showNotification(`短信解析成功: ${data.parsed.currency} ${data.parsed.amount}`, 'success');
      } else {
        this.showNotification(data.message || '短信解析失败', 'error');
      }
    } catch (error) {
      console.error('短信解析失败:', error);
      this.showNotification('短信解析失败，请重试', 'error');
    }
  }

  checkiOSEnvironment() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    
    if (!isIOS) {
      document.getElementById('ios-integration').style.display = 'none';
    }
  }

  async installShortcuts() {
    try {
      const response = await fetch('/api/ios/shortcuts');
      const shortcutsData = await response.json();
      
      // 生成快捷指令安装URL
      const shortcutURL = `shortcuts://shortcuts/import?url=${encodeURIComponent(window.location.origin + '/api/ios/shortcuts')}`;
      
      // 尝试打开快捷指令app
      window.location.href = shortcutURL;
      
      this.showNotification('正在打开快捷指令应用...', 'info');
    } catch (error) {
      console.error('安装快捷指令失败:', error);
      this.showNotification('请手动下载快捷指令应用并配置', 'error');
    }
  }

  showInstallPrompt() {
    const installInstructions = `
      添加到主屏幕步骤：
      1. 点击浏览器底部的分享按钮 📤
      2. 选择"添加到主屏幕"
      3. 点击"添加"完成安装
      
      安装后可以像原生应用一样使用！
    `;
    
    alert(installInstructions);
  }

  showNotification(message, type = 'info') {
    // 创建通知元素
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    // 添加样式
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      border-radius: 8px;
      color: white;
      font-weight: 500;
      z-index: 2000;
      opacity: 0;
      transition: opacity 0.3s ease;
    `;
    
    switch (type) {
      case 'success':
        notification.style.backgroundColor = '#34C759';
        break;
      case 'error':
        notification.style.backgroundColor = '#FF3B30';
        break;
      case 'info':
      default:
        notification.style.backgroundColor = '#007AFF';
        break;
    }
    
    document.body.appendChild(notification);
    
    // 显示动画
    setTimeout(() => {
      notification.style.opacity = '1';
    }, 10);
    
    // 3秒后自动消失
    setTimeout(() => {
      notification.style.opacity = '0';
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 3000);
  }

  // 注册Service Worker支持离线使用
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js')
        .then(registration => {
          console.log('Service Worker注册成功:', registration);
        })
        .catch(error => {
          console.error('Service Worker注册失败:', error);
        });
    }
  }
}

// 应用初始化
document.addEventListener('DOMContentLoaded', () => {
  const app = new AutoAccountingApp();
  
  // 注册PWA
  app.registerServiceWorker();
});