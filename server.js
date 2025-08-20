const express = require('express');
const path = require('path');
const { initDatabase, TransactionQueries } = require('./src/database');

const app = express();
const port = process.env.PORT || 3000;

// 中间件
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// 安全中间件
app.use((req, res, next) => {
  res.header('X-Content-Type-Options', 'nosniff');
  res.header('X-Frame-Options', 'DENY');
  res.header('X-XSS-Protection', '1; mode=block');
  next();
});

// 静态文件服务 - 添加缓存控制和错误处理
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  etag: true,
  lastModified: true
}));

// 数据库初始化
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// 主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// 显式静态文件路由（备用方案）
app.get('/css/style.css', (req, res) => {
  res.type('text/css');
  res.sendFile(path.join(__dirname, 'public', 'css', 'style.css'));
});

app.get('/js/app.js', (req, res) => {
  res.type('text/javascript');
  res.sendFile(path.join(__dirname, 'public', 'js', 'app.js'));
});

app.get('/manifest.json', (req, res) => {
  res.type('application/json');
  res.sendFile(path.join(__dirname, 'public', 'manifest.json'));
});

app.get('/sw.js', (req, res) => {
  res.type('text/javascript');
  res.sendFile(path.join(__dirname, 'public', 'sw.js'));
});

// 获取交易记录
app.get('/api/transactions', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const { limit = 100, offset = 0, start_date, end_date } = req.query;
    const limitNum = Math.min(parseInt(limit) || 100, 1000); // 最大1000条
    const offsetNum = parseInt(offset) || 0;
    
    const result = await TransactionQueries.getAll(limitNum, offsetNum, start_date, end_date);
    const total = await TransactionQueries.getCount(start_date, end_date);
    
    res.json({
      success: true,
      data: result.rows,
      count: result.rowCount,
      total: total
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取交易记录失败',
      message: error.message
    });
  }
});

// 添加交易记录
app.post('/api/transactions', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const { amount, category, description, date, type, currency = 'EUR' } = req.body;
    
    // 输入验证
    if (!amount || !category || !description || !date || !type) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段'
      });
    }
    
    // 数据类型和范围验证
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > 1000000) {
      return res.status(400).json({
        success: false,
        error: '金额必须是大于0且小于1,000,000的数字'
      });
    }
    
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '交易类型必须是income或expense'
      });
    }
    
    if (!['EUR', 'CHF', 'USD', 'CNY'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: '不支持的货币类型'
      });
    }
    
    if (description.length > 200) {
      return res.status(400).json({
        success: false,
        error: '描述不能超过200个字符'
      });
    }
    
    // 汇率转换
    const exchangeRates = {
      'EUR': 1.0,
      'CHF': 1.05,
      'USD': 1.18,
      'CNY': 0.13
    };
    
    const rate = exchangeRates[currency];
    const amountInEUR = amountNum * rate;
    
    const transactionData = {
      amount: amountNum,
      category: category.trim(),
      description: description.trim(),
      date,
      type,
      currency,
      exchange_rate: rate,
      amount_in_eur: amountInEUR
    };
    
    const result = await TransactionQueries.create(transactionData);
    
    console.log('新交易记录:', result.rows[0]);
    
    res.status(201).json({
      success: true,
      data: result.rows[0],
      message: '交易记录添加成功'
    });
  } catch (error) {
    console.error('添加交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '添加交易记录失败',
      message: error.message
    });
  }
});

// 获取单个交易记录
app.get('/api/transactions/:id', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const id = req.params.id;
    
    // UUID格式验证
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的交易记录ID格式'
      });
    }
    
    const result = await TransactionQueries.getById(id);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: '交易记录未找到'
      });
    }
    
    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('获取交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '获取交易记录失败',
      message: error.message
    });
  }
});

// 更新交易记录
app.put('/api/transactions/:id', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const id = req.params.id;
    const { amount, category, description, date, type, currency = 'EUR' } = req.body;
    
    // UUID格式验证
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的交易记录ID格式'
      });
    }
    
    // 输入验证（与添加记录相同的验证逻辑）
    if (!amount || !category || !description || !date || !type) {
      return res.status(400).json({
        success: false,
        error: '缺少必要字段'
      });
    }
    
    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0 || amountNum > 1000000) {
      return res.status(400).json({
        success: false,
        error: '金额必须是大于0且小于1,000,000的数字'
      });
    }
    
    if (!['income', 'expense'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: '交易类型必须是income或expense'
      });
    }
    
    if (!['EUR', 'CHF', 'USD', 'CNY'].includes(currency)) {
      return res.status(400).json({
        success: false,
        error: '不支持的货币类型'
      });
    }
    
    if (description.length > 200) {
      return res.status(400).json({
        success: false,
        error: '描述不能超过200个字符'
      });
    }
    
    // 汇率转换
    const exchangeRates = {
      'EUR': 1.0,
      'CHF': 1.05,
      'USD': 1.18,
      'CNY': 0.13
    };
    
    const rate = exchangeRates[currency];
    const amountInEUR = amountNum * rate;
    
    const transactionData = {
      amount: amountNum,
      category: category.trim(),
      description: description.trim(),
      date,
      type,
      currency,
      exchange_rate: rate,
      amount_in_eur: amountInEUR
    };
    
    const result = await TransactionQueries.update(id, transactionData);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: '交易记录未找到'
      });
    }
    
    console.log('更新交易记录:', result.rows[0]);
    
    res.json({
      success: true,
      data: result.rows[0],
      message: '交易记录更新成功'
    });
  } catch (error) {
    console.error('更新交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '更新交易记录失败',
      message: error.message
    });
  }
});

// 删除交易记录
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const id = req.params.id;
    
    // UUID格式验证
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({
        success: false,
        message: '无效的交易记录ID格式'
      });
    }
    
    const result = await TransactionQueries.delete(id);
    
    if (result.rowCount === 0) {
      return res.status(404).json({
        success: false,
        message: '交易记录未找到'
      });
    }
    
    console.log('删除交易记录:', result.rows[0]);
    
    res.json({
      success: true,
      message: '交易记录删除成功',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('删除交易记录失败:', error);
    res.status(500).json({
      success: false,
      error: '删除交易记录失败',
      message: error.message
    });
  }
});

// 获取余额
app.get('/api/balance', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const result = await TransactionQueries.getBalance();
    const balanceData = result.rows[0];
    
    res.json({
      success: true,
      data: {
        balance: parseFloat(balanceData.balance),
        income: parseFloat(balanceData.income),
        expense: parseFloat(balanceData.expense)
      }
    });
  } catch (error) {
    console.error('获取余额失败:', error);
    res.status(500).json({
      success: false,
      error: '获取余额失败',
      message: error.message
    });
  }
});

// 获取统计数据（为图表功能准备）
app.get('/api/stats', async (req, res) => {
  try {
    await ensureDbInitialized();
    
    const { start_date, end_date } = req.query;
    const categoryStats = await TransactionQueries.getCategoryStats(start_date, end_date);
    
    res.json({
      success: true,
      data: {
        categoryStats: categoryStats.rows
      }
    });
  } catch (error) {
    console.error('获取统计数据失败:', error);
    res.status(500).json({
      success: false,
      error: '获取统计数据失败',
      message: error.message
    });
  }
});

// 启动服务器
app.listen(port, async () => {
  console.log(`自动记账应用运行在端口 ${port}`);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  
  try {
    await ensureDbInitialized();
    console.log('数据库连接成功');
  } catch (error) {
    console.error('数据库初始化失败:', error);
    process.exit(1);
  }
});