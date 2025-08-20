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

    document.getElementById('test-applepay-btn').addEventListener('click', () => {
      this.showApplePayModal();
    });

    // 加载更多按钮 - 支持移动端
    const loadMoreBtn = document.getElementById('load-more-btn');
    loadMoreBtn.addEventListener('click', (e) => {
      e.preventDefault();
      this.loadMoreTransactions();
    });
    
    // 移动端触摸处理
    loadMoreBtn.addEventListener('touchend', (e) => {
      e.preventDefault();
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

    // 表单提交 - 支持移动端
    const transactionForm = document.getElementById('transaction-form');
    transactionForm.addEventListener('submit', (e) => {
      this.handleTransactionSubmit(e);
    });
    
    // 为移动端添加触摸事件处理
    const submitBtn = transactionForm.querySelector('.submit-btn');
    if (submitBtn) {
      // 添加触摸反馈
      submitBtn.addEventListener('touchstart', function() {
        this.style.transform = 'scale(0.95)';
      });
      
      submitBtn.addEventListener('touchend', function() {
        setTimeout(() => {
          this.style.transform = 'scale(1)';
        }, 150);
      });
      
      // 防止双击缩放
      submitBtn.addEventListener('touchend', function(e) {
        e.preventDefault();
      });
    }

    document.getElementById('sms-form').addEventListener('submit', (e) => {
      this.handleSMSSubmit(e);
    });

    document.getElementById('applepay-form').addEventListener('submit', (e) => {
      this.handleApplePaySubmit(e);
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
    // 防止重复点击
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn.disabled) return;
    
    loadMoreBtn.disabled = true;
    loadMoreBtn.textContent = '加载中...';
    
    try {
      this.currentPage++;
      await this.loadTransactions();
      
      // 如果没有更多数据，隐藏按钮
      if (this.transactions.length < (this.currentPage + 1) * this.pageSize) {
        loadMoreBtn.style.display = 'none';
      }
    } catch (error) {
      console.error('加载更多数据失败:', error);
      this.showNotification('加载失败，请重试', 'error');
      this.currentPage--; // 回退页数
    } finally {
      loadMoreBtn.disabled = false;
      loadMoreBtn.textContent = '加载更多';
    }
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
    const wrapper = document.createElement('div');
    wrapper.className = 'transaction-wrapper';
    
    const currencySymbol = this.getCurrencySymbol(transaction.currency || 'EUR');
    const formattedAmount = `${currencySymbol}${transaction.amount.toFixed(2)}`;
    
    // 如果不是EUR，显示原始金额和EUR等值
    let displayAmount = formattedAmount;
    if (transaction.currency && transaction.currency !== 'EUR' && transaction.amount_in_eur) {
      displayAmount += ` (€${transaction.amount_in_eur.toFixed(2)})`;
    }
    
    wrapper.innerHTML = `
      <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
        <div class="transaction-content">
          <div class="transaction-info">
            <div class="transaction-category">${this.getCategoryIcon(transaction.category)} ${transaction.category}</div>
            <div class="transaction-description">${transaction.description}</div>
            <div class="currency-info">${new Date(transaction.date).toLocaleDateString('zh-CN')}</div>
          </div>
          <div class="transaction-amount ${transaction.type}">
            ${transaction.type === 'expense' ? '-' : '+'}${displayAmount}
          </div>
        </div>
        <div class="delete-action">
          <button class="delete-btn" data-id="${transaction.id}">
            🗑️ 删除
          </button>
        </div>
      </div>
    `;
    
    // 添加滑动事件
    this.addSwipeEvents(wrapper.querySelector('.transaction-item'));
    
    return wrapper;
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

  showApplePayModal() {
    const modal = document.getElementById('applepay-modal');
    document.getElementById('applepay-result').style.display = 'none';
    modal.style.display = 'block';
  }

  async handleTransactionSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    // 防止重复提交
    const submitBtn = e.target.querySelector('.submit-btn');
    if (submitBtn.disabled) return;
    
    submitBtn.disabled = true;
    submitBtn.textContent = '保存中...';
    
    try {
      const formData = new FormData(e.target);
      const transactionData = {
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        description: formData.get('description'),
        date: formData.get('date'),
        type: formData.get('type'),
        currency: formData.get('currency') || 'EUR'
      };
      
      // 数据验证
      if (!transactionData.amount || transactionData.amount <= 0) {
        throw new Error('请输入有效的金额');
      }
      if (!transactionData.description.trim()) {
        throw new Error('请输入描述');
      }
      
      console.log('提交数据:', transactionData);
      
      const response = await fetch('/api/transactions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(transactionData)
      });
      
      console.log('响应状态:', response.status);
      const data = await response.json();
      console.log('响应数据:', data);
      
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
        this.showNotification(data.errors ? data.errors.join(', ') : data.error || '添加失败', 'error');
      }
    } catch (error) {
      console.error('添加交易记录失败:', error);
      this.showNotification(error.message || '添加失败，请重试', 'error');
    } finally {
      // 恢复按钮状态
      submitBtn.disabled = false;
      submitBtn.textContent = '保存';
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

  async handleApplePaySubmit(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const applePayData = {
      rawText: formData.get('rawText')
    };
    
    try {
      const response = await fetch('/api/transactions/apple-pay/parse', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(applePayData)
      });
      
      const data = await response.json();
      
      if (data.success) {
        this.showApplePayResult(data);
      } else {
        this.showNotification(data.message || 'Apple Pay解析失败', 'error');
      }
    } catch (error) {
      console.error('Apple Pay解析失败:', error);
      this.showNotification('Apple Pay解析失败，请重试', 'error');
    }
  }

  showApplePayResult(data) {
    const resultDiv = document.getElementById('applepay-result');
    const contentDiv = document.getElementById('result-content');
    
    const transaction = data.transaction;
    const confidence = data.confidence;
    
    contentDiv.innerHTML = `
      <div class="result-item">
        <strong>商户:</strong> ${transaction.description}
      </div>
      <div class="result-item">
        <strong>金额:</strong> ${transaction.formattedAmount}
      </div>
      <div class="result-item">
        <strong>分类:</strong> ${transaction.category}
      </div>
      <div class="result-item">
        <strong>货币:</strong> ${transaction.currency}
      </div>
      <div class="result-item">
        <strong>置信度:</strong> <span class="confidence">${confidence}%</span>
      </div>
    `;
    
    resultDiv.style.display = 'block';
    
    // 存储数据以便确认时使用
    this.pendingApplePayTransaction = transaction;
    
    // 绑定确认按钮
    document.getElementById('confirm-applepay').onclick = () => {
      this.confirmApplePayTransaction();
    };
  }

  async confirmApplePayTransaction() {
    if (!this.pendingApplePayTransaction) return;
    
    try {
      const response = await fetch('/api/transactions/apple-pay', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(this.pendingApplePayTransaction)
      });
      
      const data = await response.json();
      
      if (data.success) {
        // 关闭模态框
        document.getElementById('applepay-modal').style.display = 'none';
        
        // 重新加载数据
        this.currentPage = 0;
        await this.loadBalance();
        await this.loadTransactions();
        await this.loadTodayStats();
        
        this.showNotification(`智能记账成功! 置信度: ${data.confidence}%`, 'success');
        this.pendingApplePayTransaction = null;
      } else {
        this.showNotification(data.message || '添加失败', 'error');
      }
    } catch (error) {
      console.error('确认Apple Pay交易失败:', error);
      this.showNotification('添加失败，请重试', 'error');
    }
  }

  checkiOSEnvironment() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || 
                  (navigator.userAgent.includes('Mac') && 'ontouchend' in document);
    
    // 为了测试，先不隐藏iOS功能，但会显示提示信息
    if (!isIOS) {
      const iosSection = document.getElementById('ios-integration');
      if (iosSection) {
        const warning = document.createElement('div');
        warning.className = 'ios-warning';
        warning.style.cssText = `
          background: #fff3cd;
          color: #856404;
          padding: 10px;
          border-radius: 5px;
          margin-bottom: 10px;
          text-align: center;
          font-size: 14px;
        `;
        warning.textContent = '📱 iOS功能需要在iPhone或iPad上使用';
        iosSection.insertBefore(warning, iosSection.firstChild);
      }
    }
  }

  async installShortcuts() {
    // 显示详细的快捷指令创建教程
    this.showShortcutTutorial();
  }

  showShortcutTutorial() {
    // 创建教程模态框
    const modal = document.createElement('div');
    modal.className = 'modal';
    modal.style.display = 'block';
    
    modal.innerHTML = `
      <div class="modal-content" style="max-width: 500px; max-height: 80vh; overflow-y: auto;">
        <span class="close">&times;</span>
        <h2>📱 创建快捷指令教程</h2>
        
        <div class="tutorial-section">
          <h3>第一步：打开快捷指令应用</h3>
          <p>在iPhone上找到"快捷指令"应用并打开</p>
        </div>
        
        <div class="tutorial-section">
          <h3>第二步：创建新快捷指令</h3>
          <ol>
            <li>点击右上角的 <strong>"+"</strong> 按钮</li>
            <li>点击 <strong>"添加操作"</strong></li>
          </ol>
        </div>
        
        <div class="tutorial-section">
          <h3>第三步：添加操作步骤</h3>
          <div class="action-step">
            <h4>1️⃣ 添加"询问输入"操作</h4>
            <ul>
              <li>搜索"询问输入"</li>
              <li>提示文字：<code>请输入支出金额</code></li>
              <li>输入类型：<code>数字</code></li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>2️⃣ 添加第二个"询问输入"操作</h4>
            <ul>
              <li>提示文字：<code>选择消费类别</code></li>
              <li>输入类型：<code>从菜单中选择</code></li>
              <li>菜单项目：餐饮、交通、娱乐、日用品、医疗、服装、教育、其他</li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>3️⃣ 添加第三个"询问输入"操作</h4>
            <ul>
              <li>提示文字：<code>请输入消费描述</code></li>
              <li>输入类型：<code>文本</code></li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>4️⃣ 添加"获取URL内容"操作</h4>
            <ul>
              <li>URL：<code>${window.location.origin}/api/transactions</code></li>
              <li>方法：<code>POST</code></li>
              <li>请求体：选择<code>JSON</code></li>
              <li>JSON内容：
                <pre>{
  "amount": "询问输入的结果",
  "category": "所选菜单项目", 
  "description": "询问输入的结果",
  "type": "expense",
  "currency": "EUR",
  "date": "当前日期"
}</pre>
              </li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>5️⃣ 添加"显示通知"操作</h4>
            <ul>
              <li>标题：<code>记账成功</code></li>
              <li>正文：<code>支出已记录</code></li>
            </ul>
          </div>
        </div>
        
        <div class="tutorial-section">
          <h3>第四步：保存快捷指令</h3>
          <ol>
            <li>点击右上角 <strong>"下一步"</strong></li>
            <li>输入名称：<strong>"快速记账"</strong></li>
            <li>选择图标（可选）</li>
            <li>点击 <strong>"完成"</strong></li>
          </ol>
        </div>
        
        <div class="tutorial-section">
          <h3>✅ 使用方法</h3>
          <p>创建完成后，可以通过以下方式使用：</p>
          <ul>
            <li>在快捷指令应用中直接运行</li>
            <li>添加到主屏幕作为快捷方式</li>
            <li>通过Siri语音："嘿Siri，快速记账"</li>
            <li>在控制中心添加快捷指令按钮</li>
          </ul>
        </div>
        
        <button class="submit-btn" onclick="this.closest('.modal').remove()">我知道了</button>
      </div>
    `;
    
    document.body.appendChild(modal);
    
    // 添加关闭功能
    modal.querySelector('.close').onclick = () => modal.remove();
    modal.onclick = (e) => {
      if (e.target === modal) modal.remove();
    };
    
    this.showNotification('快捷指令教程已打开，请按步骤创建', 'info');
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

  addSwipeEvents(element) {
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwipping = false;
    let threshold = 80; // 滑动阈值
    
    // 触摸开始
    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwipping = false;
      element.style.transition = '';
    });
    
    // 触摸移动
    element.addEventListener('touchmove', (e) => {
      if (!startX) return;
      
      currentX = e.touches[0].clientX;
      const currentY = e.touches[0].clientY;
      
      const diffX = startX - currentX;
      const diffY = Math.abs(startY - currentY);
      
      // 只有横向滑动才触发
      if (Math.abs(diffX) > diffY && Math.abs(diffX) > 10) {
        e.preventDefault();
        isSwipping = true;
        
        // 只允许向左滑动
        const translateX = diffX > 0 ? Math.min(diffX, threshold) : 0;
        element.style.transform = `translateX(-${translateX}px)`;
        
        // 显示删除按钮
        if (translateX > 20) {
          element.classList.add('swipe-active');
        }
      }
    });
    
    // 触摸结束
    element.addEventListener('touchend', (e) => {
      if (!isSwipping) return;
      
      element.style.transition = 'transform 0.3s ease';
      
      const diffX = startX - currentX;
      
      // 如果滑动距离超过阈值，显示删除按钮
      if (diffX >= threshold) {
        element.style.transform = `translateX(-${threshold}px)`;
        element.classList.add('swipe-revealed');
        
        // 点击删除按钮时的处理
        const deleteBtn = element.querySelector('.delete-btn');
        deleteBtn.onclick = () => {
          const transactionId = element.dataset.id;
          this.deleteTransaction(transactionId);
        };
      } else {
        // 回弹
        element.style.transform = 'translateX(0)';
        element.classList.remove('swipe-active', 'swipe-revealed');
      }
      
      startX = 0;
      currentX = 0;
    });
    
    // 点击其他地方时隐藏删除按钮
    element.addEventListener('click', (e) => {
      if (!element.classList.contains('swipe-revealed')) {
        // 隐藏其他已显示的删除按钮
        document.querySelectorAll('.transaction-item.swipe-revealed').forEach(item => {
          if (item !== element) {
            item.style.transform = 'translateX(0)';
            item.classList.remove('swipe-active', 'swipe-revealed');
          }
        });
      }
    });
  }

  async deleteTransaction(transactionId) {
    if (!confirm('确定要删除这条交易记录吗？')) {
      return;
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // 重新加载数据
        this.currentPage = 0;
        await this.loadBalance();
        await this.loadTransactions();
        await this.loadTodayStats();
        
        this.showNotification('交易记录删除成功', 'success');
      } else {
        this.showNotification(data.message || '删除失败', 'error');
      }
    } catch (error) {
      console.error('删除交易记录失败:', error);
      this.showNotification('删除失败，请重试', 'error');
    }
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
let app; // 全局变量，供删除按钮使用
document.addEventListener('DOMContentLoaded', () => {
  app = new AutoAccountingApp();
  
  // 注册PWA
  app.registerServiceWorker();
});