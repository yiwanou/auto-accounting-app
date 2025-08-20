const express = require('express');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// 内存存储（简化版）
let transactions = [
  {
    id: 'demo_1',
    amount: 25.50,
    category: '餐饮',
    description: 'Starbucks 咖啡',
    date: '2025-08-20',
    type: 'expense',
    currency: 'CHF',
    exchange_rate: 1.05,
    amount_in_eur: 26.78,
    created_at: '2025-08-20T10:00:00Z'
  },
  {
    id: 'demo_2',
    amount: 1200.00,
    category: '工资',
    description: '月薪',
    date: '2025-08-19',
    type: 'income',
    currency: 'EUR',
    exchange_rate: 1.0,
    amount_in_eur: 1200.00,
    created_at: '2025-08-19T09:00:00Z'
  },
  {
    id: 'demo_3',
    amount: 45.80,
    category: '日用品',
    description: 'Migros 购物',
    date: '2025-08-19',
    type: 'expense',
    currency: 'CHF',
    exchange_rate: 1.05,
    amount_in_eur: 48.09,
    created_at: '2025-08-19T15:30:00Z'
  }
];
let nextId = 4;

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 获取交易记录
app.get('/api/transactions', (req, res) => {
  const { limit = 100, offset = 0 } = req.query;
  const start = parseInt(offset);
  const count = parseInt(limit);
  
  const result = transactions
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(start, start + count);
    
  res.json({
    success: true,
    data: result,
    count: result.length,
    total: transactions.length
  });
});

// 添加交易记录
app.post('/api/transactions', (req, res) => {
  try {
    const { amount, category, description, date, type, currency = 'EUR' } = req.body;
    
    // 基础验证
    if (!amount || !category || !description || !date || !type) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段'
      });
    }
    
    // 汇率转换
    const exchangeRates = {
      'EUR': 1.0,
      'CHF': 1.05,
      'USD': 1.18,
      'CNY': 0.13
    };
    
    const rate = exchangeRates[currency] || 1.0;
    const amountInEUR = parseFloat(amount) * rate;
    
    const transaction = {
      id: 'txn_' + nextId++,
      amount: parseFloat(amount),
      category,
      description,
      date,
      type,
      currency,
      exchange_rate: rate,
      amount_in_eur: amountInEUR,
      created_at: new Date().toISOString()
    };
    
    transactions.push(transaction);
    
    console.log('新交易记录:', transaction);
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: '交易记录添加成功'
    });
  } catch (error) {
    console.error('添加交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 删除交易记录
app.delete('/api/transactions/:id', (req, res) => {
  const id = req.params.id;
  const index = transactions.findIndex(t => t.id === id);
  
  if (index === -1) {
    return res.status(404).json({
      success: false,
      message: '交易记录未找到'
    });
  }
  
  transactions.splice(index, 1);
  
  res.json({
    success: true,
    message: '交易记录删除成功'
  });
});

// 获取余额
app.get('/api/balance', (req, res) => {
  const income = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + (t.amount_in_eur || t.amount), 0);
    
  const expense = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + (t.amount_in_eur || t.amount), 0);
    
  res.json({
    success: true,
    data: {
      balance: income - expense,
      income: income,
      expense: expense
    }
  });
});

// 启动服务器
app.listen(port, () => {
  console.log(`简化版记账应用运行在端口 ${port}`);
  console.log('NODE_ENV:', process.env.NODE_ENV);
});