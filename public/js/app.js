class AutoAccountingApp {
  constructor() {
    this.transactions = [];
    this.balance = { balance: 0, income: 0, expense: 0 };
    this.currentPage = 0;
    this.pageSize = 20;
    this.editingTransaction = null; // 当前编辑的交易记录
    
    this.init();
  }

  init() {
    this.bindEvents();
    this.loadBalance();
    this.loadTransactions();
    this.loadTodayStats();
    this.checkiOSEnvironment();
    
    // 初始化加载更多按钮状态
    document.getElementById('load-more-btn').style.display = 'none';
  }

  bindEvents() {
    // 快速操作按钮
    document.getElementById('add-expense-btn').addEventListener('click', () => {
      this.showTransactionModal('expense');
    });

    document.getElementById('add-income-btn').addEventListener('click', () => {
      this.showTransactionModal('income');
    });

    document.getElementById('view-stats-btn').addEventListener('click', () => {
      this.showStatsPage();
    });

    document.getElementById('back-to-main-btn').addEventListener('click', () => {
      this.showMainPage();
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

    // 表单提交处理
    this.setupFormValidation();


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
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      
      if (data.success) {
        if (this.currentPage === 0) {
          this.transactions = data.data || [];
        } else {
          this.transactions = [...this.transactions, ...(data.data || [])];
        }
        this.renderTransactions();
        this.updateLoadMoreButton((data.data || []).length, data.total || 0);
      } else {
        console.error('API返回错误:', data.error || data.message);
        this.showNotification(data.error || data.message || '加载交易记录失败', 'error');
        
        // 如果是首次加载，显示空状态
        if (this.currentPage === 0) {
          this.transactions = [];
          this.renderTransactions();
        }
      }
    } catch (error) {
      console.error('加载交易记录失败:', error);
      this.showNotification('网络错误或服务器无响应', 'error');
      
      // 如果是首次加载，显示空状态
      if (this.currentPage === 0) {
        this.transactions = [];
        this.renderTransactions();
      }
    }
  }

  updateLoadMoreButton(currentBatchSize, totalCount) {
    const loadMoreBtn = document.getElementById('load-more-btn');
    const loadedCount = this.transactions.length;
    
    // 只有在还有更多数据时才显示按钮
    if (totalCount > loadedCount && currentBatchSize === this.pageSize) {
      loadMoreBtn.style.display = 'block';
      loadMoreBtn.textContent = `加载更多 (还有 ${totalCount - loadedCount} 条)`;
    } else {
      loadMoreBtn.style.display = 'none';
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
    } catch (error) {
      console.error('加载更多数据失败:', error);
      this.showNotification('加载失败，请重试', 'error');
      this.currentPage--; // 回退页数
    } finally {
      loadMoreBtn.disabled = false;
    }
  }

  renderTransactions() {
    const container = document.getElementById('transactions-list');
    
    if (this.currentPage === 0) {
      container.innerHTML = '';
    }
    
    // 获取当前页的数据
    const startIndex = this.currentPage * this.pageSize;
    const pageTransactions = this.transactions.slice(startIndex, startIndex + this.pageSize);
    
    if (pageTransactions.length === 0 && this.currentPage === 0) {
      // 显示无数据提示
      container.innerHTML = `
        <div class="no-transactions" style="text-align: center; padding: 40px; color: #86868b;">
          <div style="font-size: 3rem; margin-bottom: 16px;">📝</div>
          <div style="font-size: 1.1rem; margin-bottom: 8px;">还没有交易记录</div>
          <div style="font-size: 0.9rem;">点击上方按钮开始记账吧！</div>
        </div>
      `;
      return;
    }
    
    pageTransactions.forEach(transaction => {
      const element = this.createTransactionElement(transaction);
      container.appendChild(element);
    });
  }

  createTransactionElement(transaction) {
    const wrapper = document.createElement('div');
    wrapper.className = 'transaction-wrapper';
    
    const currencySymbol = this.getCurrencySymbol(transaction.currency || 'EUR');
    const amount = parseFloat(transaction.amount);
    const formattedAmount = `${currencySymbol}${amount.toFixed(2)}`;
    
    // 如果不是EUR，显示原始金额和EUR等值
    let displayAmount = formattedAmount;
    if (transaction.currency && transaction.currency !== 'EUR' && transaction.amount_in_eur) {
      const amountInEur = parseFloat(transaction.amount_in_eur);
      displayAmount += ` (€${amountInEur.toFixed(2)})`;
    }
    
    wrapper.innerHTML = `
      <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
        <div class="transaction-content">
          <div class="transaction-info">
            <div class="transaction-category">${this.getCategoryIcon(transaction.category)} ${transaction.category}</div>
            <div class="transaction-description">${transaction.description}</div>
            <div class="currency-info">${new Date(transaction.date).toLocaleDateString('zh-CN')}</div>
          </div>
          <div class="transaction-right">
            <div class="transaction-amount ${transaction.type}">
              ${transaction.type === 'expense' ? '-' : '+'}${displayAmount}
            </div>
            <button class="edit-btn" onclick="app.editTransaction('${transaction.id}')" title="编辑">
              ✏️
            </button>
          </div>
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
          .reduce((sum, t) => sum + parseFloat(t.amount_in_eur || t.amount), 0);
        
        const expense = todayTransactions
          .filter(t => t.type === 'expense')
          .reduce((sum, t) => sum + parseFloat(t.amount_in_eur || t.amount), 0);
        
        document.getElementById('today-income').textContent = `€${income.toFixed(2)}`;
        document.getElementById('today-expense').textContent = `€${expense.toFixed(2)}`;
        document.getElementById('today-balance').textContent = `€${(income - expense).toFixed(2)}`;
      }
    } catch (error) {
      console.error('加载今日统计失败:', error);
    }
  }

  showTransactionModal(type, transaction = null) {
    const modal = document.getElementById('add-transaction-modal');
    const form = document.getElementById('transaction-form');
    const title = document.getElementById('modal-title');
    const typeInput = document.getElementById('type');
    const categorySelect = document.getElementById('category');
    
    // 清空之前的数据
    form.reset();
    form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
    form.querySelectorAll('.error-message').forEach(el => el.textContent = '');
    
    if (transaction) {
      // 编辑模式
      this.editingTransaction = transaction;
      title.textContent = transaction.type === 'expense' ? '编辑支出' : '编辑收入';
      typeInput.value = transaction.type;
      
      // 填充表单数据
      document.getElementById('amount').value = parseFloat(transaction.amount);
      document.getElementById('description').value = transaction.description;
      document.getElementById('currency').value = transaction.currency;
      document.getElementById('date').value = transaction.date.split('T')[0]; // 只取日期部分
    } else {
      // 添加模式
      this.editingTransaction = null;
      title.textContent = type === 'expense' ? '添加支出' : '添加收入';
      typeInput.value = type;
      // 设置默认日期
      document.getElementById('date').value = new Date().toISOString().split('T')[0];
    }
    
    const currentType = this.editingTransaction ? this.editingTransaction.type : type;
    
    // 更新分类选项
    if (currentType === 'income') {
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
    
    // 如果是编辑模式，设置当前分类
    if (transaction) {
      categorySelect.value = transaction.category;
    }
    
    modal.style.display = 'block';
  }

  // 编辑交易记录
  async editTransaction(transactionId) {
    try {
      // 获取交易记录详情
      const response = await fetch(`/api/transactions/${transactionId}`);
      const data = await response.json();
      
      if (data.success) {
        this.showTransactionModal(data.data.type, data.data);
      } else {
        this.showNotification('无法获取交易记录详情', 'error');
      }
    } catch (error) {
      console.error('获取交易记录失败:', error);
      this.showNotification('网络错误，请重试', 'error');
    }
  }


  setupFormValidation() {
    const form = document.getElementById('transaction-form');
    const submitBtn = document.getElementById('submit-btn');
    
    // 表单提交处理
    form.addEventListener('submit', (e) => this.handleFormSubmit(e));
    
    // iOS触摸优化
    this.addMobileTouchSupport(submitBtn);
    
    // 实时验证
    const inputs = form.querySelectorAll('input[required], select[required]');
    inputs.forEach(input => {
      input.addEventListener('blur', () => this.validateField(input));
      input.addEventListener('input', () => this.clearFieldError(input));
    });
  }
  
  addMobileTouchSupport(button) {
    let touchStartTime = 0;
    
    // 触摸开始
    button.addEventListener('touchstart', (e) => {
      touchStartTime = Date.now();
      button.style.transform = 'scale(0.95)';
      button.style.backgroundColor = '#0056CC';
    }, { passive: false });
    
    // 触摸结束 - 主要的点击处理
    button.addEventListener('touchend', (e) => {
      e.preventDefault();
      e.stopPropagation();
      
      const touchDuration = Date.now() - touchStartTime;
      
      // 恢复样式
      button.style.transform = 'scale(1)';
      button.style.backgroundColor = '#007AFF';
      
      // 只有在快速点击时才触发表单提交
      if (touchDuration < 500 && !button.disabled) {
        // 直接触发表单提交
        const form = button.closest('form');
        if (form) {
          const submitEvent = new Event('submit', {
            bubbles: true,
            cancelable: true
          });
          form.dispatchEvent(submitEvent);
        }
      }
    }, { passive: false });
    
    // 触摸移动时取消操作
    button.addEventListener('touchmove', (e) => {
      e.preventDefault();
      button.style.transform = 'scale(1)';
      button.style.backgroundColor = '#007AFF';
    }, { passive: false });
    
    // 触摸取消时重置
    button.addEventListener('touchcancel', (e) => {
      button.style.transform = 'scale(1)';
      button.style.backgroundColor = '#007AFF';
    });
    
    // 添加点击事件作为备用
    button.addEventListener('click', (e) => {
      // 如果不是触摸设备，允许正常点击
      if (!('ontouchstart' in window)) {
        return; // 让默认行为处理
      }
      
      // 对于触摸设备，防止双重触发
      e.preventDefault();
      e.stopPropagation();
    });
  }
  
  validateField(field) {
    const fieldName = field.name;
    const value = field.value.trim();
    const errorElement = document.getElementById(`${fieldName}-error`);
    
    let errorMessage = '';
    
    switch(fieldName) {
      case 'amount':
        if (!value) {
          errorMessage = '请输入金额';
        } else if (isNaN(value) || parseFloat(value) <= 0) {
          errorMessage = '请输入有效的金额';
        }
        break;
      case 'category':
        if (!value) {
          errorMessage = '请选择分类';
        }
        break;
      case 'description':
        if (!value) {
          errorMessage = '请输入描述';
        } else if (value.length > 50) {
          errorMessage = '描述不能超过50个字符';
        }
        break;
      case 'date':
        if (!value) {
          errorMessage = '请选择日期';
        }
        break;
    }
    
    if (errorMessage) {
      field.classList.add('error');
      if (errorElement) errorElement.textContent = errorMessage;
      return false;
    } else {
      field.classList.remove('error');
      if (errorElement) errorElement.textContent = '';
      return true;
    }
  }
  
  clearFieldError(field) {
    field.classList.remove('error');
    const errorElement = document.getElementById(`${field.name}-error`);
    if (errorElement) errorElement.textContent = '';
  }
  
  async handleFormSubmit(e) {
    e.preventDefault();
    e.stopPropagation();
    
    const form = e.target;
    const submitBtn = document.getElementById('submit-btn');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoading = submitBtn.querySelector('.btn-loading');
    
    // 防止重复提交
    if (submitBtn.disabled) return;
    
    // 验证所有字段
    const inputs = form.querySelectorAll('input[required], select[required]');
    let isValid = true;
    
    inputs.forEach(input => {
      if (!this.validateField(input)) {
        isValid = false;
      }
    });
    
    if (!isValid) {
      this.showNotification('请检查输入信息', 'error');
      return;
    }
    
    // 设置加载状态
    submitBtn.disabled = true;
    if (btnText) btnText.style.display = 'none';
    if (btnLoading) btnLoading.style.display = 'block';
    submitBtn.textContent = '⏳ 保存中...';
    
    try {
      const formData = new FormData(form);
      const transactionData = {
        amount: parseFloat(formData.get('amount')),
        category: formData.get('category'),
        description: formData.get('description').trim(),
        date: formData.get('date'),
        type: formData.get('type'),
        currency: formData.get('currency') || 'EUR'
      };
      
      let response, data;
      
      if (this.editingTransaction) {
        // 编辑模式 - PUT 请求
        response = await fetch(`/api/transactions/${this.editingTransaction.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData)
        });
      } else {
        // 添加模式 - POST 请求
        response = await fetch('/api/transactions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(transactionData)
        });
      }
      
      data = await response.json();
      
      if (data.success) {
        // 关闭模态框
        document.getElementById('add-transaction-modal').style.display = 'none';
        
        // 清空表单和错误信息
        form.reset();
        form.querySelectorAll('.error').forEach(el => el.classList.remove('error'));
        form.querySelectorAll('.error-message').forEach(el => el.textContent = '');
        
        // 重新加载数据
        this.currentPage = 0;
        await this.loadBalance();
        await this.loadTransactions();
        await this.loadTodayStats();
        
        const message = this.editingTransaction ? '交易记录更新成功' : '交易记录添加成功';
        this.showNotification(message, 'success');
        
        // 清空编辑状态
        this.editingTransaction = null;
      } else {
        const errorMessage = this.editingTransaction ? '更新失败' : '添加失败';
        this.showNotification(data.error || errorMessage, 'error');
      }
    } catch (error) {
      console.error('保存交易记录失败:', error);
      this.showNotification('网络错误，请重试', 'error');
    } finally {
      // 恢复按钮状态
      submitBtn.disabled = false;
      if (btnText) btnText.style.display = 'block';
      if (btnLoading) btnLoading.style.display = 'none';
      submitBtn.innerHTML = '<span class="btn-text">💾 保存</span><span class="btn-loading" style="display: none;">⏳ 保存中...</span>';
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
            <h4>4️⃣ 添加"格式化日期"操作</h4>
            <ul>
              <li>搜索"格式化日期"</li>
              <li>日期：选择<code>当前日期</code></li>
              <li>格式：<code>自定义</code></li>
              <li>格式字符串：<code>yyyy-MM-dd</code></li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>5️⃣ 添加"获取URL内容"操作</h4>
            <ul>
              <li>URL：<code>https://auto-accounting-app-5fnh.onrender.com/api/transactions</code></li>
              <li>方法：<code>POST</code></li>
              <li>请求体：选择<code>JSON</code></li>
              <li>标头：
                <pre>Content-Type: application/json</pre>
              </li>
              <li>JSON内容（点击"magic variable"添加变量）：
                <pre>{
  "amount": [第一个询问输入的结果],
  "category": [第二个询问输入的结果], 
  "description": [第三个询问输入的结果],
  "type": "expense",
  "currency": "EUR",
  "date": "[格式化日期的结果]"
}</pre>
              </li>
            </ul>
          </div>
          
          <div class="action-step">
            <h4>6️⃣ 添加"显示通知"操作</h4>
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
          <h3>⚠️ 重要提醒</h3>
          <ul>
            <li>在"获取URL内容"操作中，确保添加正确的标头</li>
            <li>JSON格式必须严格按照上述格式，注意逗号和引号</li>
            <li>Magic Variable（魔法变量）必须正确对应每个"询问输入"的结果</li>
            <li>测试前请确保网络连接正常</li>
          </ul>
        </div>
        
        <div class="tutorial-section">
          <h3>✅ 使用方法</h3>
          <p>创建完成后，可以通过以下方式使用：</p>
          <ul>
            <li>在快捷指令应用中直接运行</li>
            <li>添加到主屏幕作为快捷方式</li>
            <li>通过Siri语音："嘿Siri，快速记账"</li>
            <li>在控制中心添加快捷指令按钮</li>
            <li>通过Apple Watch运行（如果支持）</li>
          </ul>
        </div>
        
        <div class="tutorial-section">
          <h3>🔧 故障排除</h3>
          <p>如果快捷指令无法正常工作：</p>
          <ul>
            <li>检查网络连接是否正常</li>
            <li>确认URL地址输入正确</li>
            <li>验证JSON格式是否有语法错误</li>
            <li>确保所有Magic Variable都已正确设置</li>
            <li>尝试在快捷指令中启用"调试模式"查看错误信息</li>
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
    let deleteThreshold = 120; // 删除阈值
    let warningThreshold = 60;  // 警告阈值（变红）
    
    // 触摸开始
    element.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      isSwipping = false;
      element.style.transition = '';
      
      // 隐藏其他已显示状态的项目
      document.querySelectorAll('.transaction-item.swipe-warning, .transaction-item.swipe-delete').forEach(item => {
        if (item !== element) {
          item.style.transform = 'translateX(0)';
          item.classList.remove('swipe-warning', 'swipe-delete');
        }
      });
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
        const translateX = diffX > 0 ? Math.min(diffX, deleteThreshold) : 0;
        element.style.transform = `translateX(-${translateX}px)`;
        
        // 根据滑动距离改变状态
        element.classList.remove('swipe-warning', 'swipe-delete');
        
        if (translateX >= deleteThreshold) {
          // 达到删除阈值，变为深红色
          element.classList.add('swipe-delete');
        } else if (translateX >= warningThreshold) {
          // 达到警告阈值，变为浅红色
          element.classList.add('swipe-warning');
        }
      }
    });
    
    // 触摸结束
    element.addEventListener('touchend', (e) => {
      if (!isSwipping) return;
      
      const diffX = startX - currentX;
      const translateX = diffX > 0 ? Math.min(diffX, deleteThreshold) : 0;
      
      if (translateX >= deleteThreshold) {
        // 达到删除阈值，直接删除
        const transactionId = element.dataset.id;
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        element.style.transform = 'translateX(-100%)';
        element.style.opacity = '0';
        
        setTimeout(() => {
          this.deleteTransaction(transactionId);
        }, 300);
        
      } else {
        // 回弹
        element.style.transition = 'transform 0.3s ease';
        element.style.transform = 'translateX(0)';
        element.classList.remove('swipe-warning', 'swipe-delete');
      }
      
      startX = 0;
      currentX = 0;
      isSwipping = false;
    });
    
    // 点击时隐藏其他项目的滑动状态
    element.addEventListener('click', (e) => {
      document.querySelectorAll('.transaction-item.swipe-warning, .transaction-item.swipe-delete').forEach(item => {
        if (item !== element) {
          item.style.transform = 'translateX(0)';
          item.classList.remove('swipe-warning', 'swipe-delete');
        }
      });
    });
  }

  async deleteTransaction(transactionId) {
    // 移除确认对话框，让滑动删除更流畅
    // 先从UI中移除该项目（乐观更新）
    const transactionElement = document.querySelector(`[data-id="${transactionId}"]`);
    if (transactionElement) {
      transactionElement.style.opacity = '0.5';
      transactionElement.style.pointerEvents = 'none';
    }

    try {
      const response = await fetch(`/api/transactions/${transactionId}`, {
        method: 'DELETE'
      });

      const data = await response.json();

      if (data.success) {
        // 从数组中移除
        this.transactions = this.transactions.filter(t => t.id !== transactionId);
        
        // 重新渲染交易列表
        this.renderTransactions();
        
        // 更新余额和统计
        await this.loadBalance();
        await this.loadTodayStats();
        
        // 重新计算加载更多按钮
        await this.loadTransactions();
        
        this.showNotification('交易记录删除成功', 'success');
      } else {
        // 删除失败，恢复UI状态
        if (transactionElement) {
          transactionElement.style.opacity = '1';
          transactionElement.style.pointerEvents = 'auto';
        }
        this.showNotification(data.message || '删除失败', 'error');
      }
    } catch (error) {
      // 删除失败，恢复UI状态
      if (transactionElement) {
        transactionElement.style.opacity = '1';
        transactionElement.style.pointerEvents = 'auto';
      }
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

  // 显示统计页面
  showStatsPage() {
    // 隐藏主页内容
    document.querySelector('.today-stats').style.display = 'none';
    document.querySelector('.recent-transactions').style.display = 'none';
    document.querySelector('.ios-integration').style.display = 'none';
    
    // 显示统计页面
    document.getElementById('stats-page').style.display = 'block';
    
    // 切换按钮状态
    document.getElementById('add-expense-btn').style.display = 'none';
    document.getElementById('add-income-btn').style.display = 'none';
    document.getElementById('view-stats-btn').style.display = 'none';
    document.getElementById('back-to-main-btn').style.display = 'block';
    
    // 调整按钮布局
    document.querySelector('.quick-actions').classList.add('stats-mode');
    
    // 加载统计数据
    this.loadStatsData();
  }

  // 显示主页
  showMainPage() {
    // 显示主页内容
    document.querySelector('.today-stats').style.display = 'block';
    document.querySelector('.recent-transactions').style.display = 'block';
    document.querySelector('.ios-integration').style.display = 'block';
    
    // 隐藏统计页面
    document.getElementById('stats-page').style.display = 'none';
    
    // 恢复按钮状态
    document.getElementById('add-expense-btn').style.display = 'block';
    document.getElementById('add-income-btn').style.display = 'block';
    document.getElementById('view-stats-btn').style.display = 'block';
    document.getElementById('back-to-main-btn').style.display = 'none';
    
    // 恢复按钮布局
    document.querySelector('.quick-actions').classList.remove('stats-mode');
  }

  // 加载统计数据
  async loadStatsData() {
    try {
      const response = await fetch('/api/stats');
      const data = await response.json();
      
      if (data.success) {
        this.renderCategoryChart(data.data.categoryStats);
        this.renderTrendChart();
        this.renderStatsSummary(data.data.categoryStats);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      this.showNotification('统计数据加载失败', 'error');
    }
  }

  // 渲染分类图表
  renderCategoryChart(categoryStats) {
    const ctx = document.getElementById('category-chart').getContext('2d');
    
    // 只显示支出分类
    const expenseStats = categoryStats.filter(stat => stat.type === 'expense');
    const labels = expenseStats.map(stat => `${this.getCategoryIcon(stat.category)} ${stat.category}`);
    const data = expenseStats.map(stat => parseFloat(stat.total_amount));
    
    // iOS 风格配色
    const colors = [
      '#FF3B30', '#FF9500', '#FFCC00', '#34C759', 
      '#00C7BE', '#007AFF', '#5856D6', '#AF52DE'
    ];
    
    new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: colors.slice(0, data.length),
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              padding: 20,
              usePointStyle: true,
              font: {
                size: 12
              }
            }
          }
        }
      }
    });
  }

  // 渲染趋势图表 (简化版)
  renderTrendChart() {
    const ctx = document.getElementById('trend-chart').getContext('2d');
    
    // 获取最近7天的数据
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      last7Days.push(date.toISOString().split('T')[0]);
    }
    
    // 模拟数据 (实际项目中应该从API获取)
    const incomeData = [0, 1200, 0, 0, 0, 0, 0];
    const expenseData = [25.50, 45.80, 12.40, 85.00, 30.20, 18.60, 22.40];
    
    new Chart(ctx, {
      type: 'line',
      data: {
        labels: last7Days.map(date => new Date(date).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })),
        datasets: [
          {
            label: '收入',
            data: incomeData,
            borderColor: '#34C759',
            backgroundColor: 'rgba(52, 199, 89, 0.1)',
            tension: 0.4
          },
          {
            label: '支出',
            data: expenseData,
            borderColor: '#FF3B30',
            backgroundColor: 'rgba(255, 59, 48, 0.1)',
            tension: 0.4
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: function(value) {
                return '€' + value.toFixed(2);
              }
            }
          }
        },
        plugins: {
          legend: {
            position: 'top'
          }
        }
      }
    });
  }

  // 渲染统计摘要
  renderStatsSummary(categoryStats) {
    const container = document.getElementById('stats-summary');
    
    const totalExpense = categoryStats
      .filter(stat => stat.type === 'expense')
      .reduce((sum, stat) => sum + parseFloat(stat.total_amount), 0);
      
    const totalIncome = categoryStats
      .filter(stat => stat.type === 'income')
      .reduce((sum, stat) => sum + parseFloat(stat.total_amount), 0);
    
    const totalTransactions = categoryStats
      .reduce((sum, stat) => sum + parseInt(stat.count), 0);
    
    const avgExpense = totalExpense / (categoryStats.filter(s => s.type === 'expense').length || 1);
    
    container.innerHTML = `
      <div class="stat-card expense">
        <h3>总支出</h3>
        <div class="value">€${totalExpense.toFixed(2)}</div>
      </div>
      <div class="stat-card income">
        <h3>总收入</h3>
        <div class="value">€${totalIncome.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <h3>净收入</h3>
        <div class="value">€${(totalIncome - totalExpense).toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <h3>交易笔数</h3>
        <div class="value">${totalTransactions}</div>
      </div>
      <div class="stat-card">
        <h3>平均支出</h3>
        <div class="value">€${avgExpense.toFixed(2)}</div>
      </div>
      <div class="stat-card">
        <h3>最大支出分类</h3>
        <div class="value">${categoryStats.find(s => s.type === 'expense')?.category || 'N/A'}</div>
      </div>
    `;
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