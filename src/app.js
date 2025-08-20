const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const path = require('path');

const DatabaseService = require('./services/DatabaseService');
const PaymentProcessor = require('./services/PaymentProcessor');
const SmartApplePayProcessor = require('./services/SmartApplePayProcessor');
const iOSIntegration = require('./services/iOSIntegration');

const app = express();
const port = process.env.PORT || 3000;

console.log('启动应用...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', port);

// 初始化服务
let db, paymentProcessor, smartApplePayProcessor, iOSService;

try {
  console.log('初始化数据库服务...');
  db = new DatabaseService();
  
  console.log('初始化支付处理服务...');
  paymentProcessor = new PaymentProcessor();
  smartApplePayProcessor = new SmartApplePayProcessor();
  
  console.log('初始化iOS集成服务...');
  iOSService = new iOSIntegration();
  
  console.log('所有服务初始化完成');
} catch (error) {
  console.error('服务初始化失败:', error);
  process.exit(1);
}

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// 健康检查端点
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// PWA manifest
app.get('/manifest.json', (req, res) => {
  res.json(iOSService.generatePWAManifest());
});

// API路由 - 交易记录
app.get('/api/transactions', async (req, res) => {
  try {
    const { limit = 100, offset = 0, start_date, end_date } = req.query;
    
    let transactions;
    if (start_date && end_date) {
      transactions = await db.getTransactionsByDateRange(start_date, end_date);
    } else {
      transactions = await db.getAllTransactions(parseInt(limit), parseInt(offset));
    }
    
    res.json({
      success: true,
      data: transactions,
      count: transactions.length
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 添加交易记录
app.post('/api/transactions', async (req, res) => {
  try {
    const Transaction = require('./models/Transaction');
    
    // 验证数据
    const errors = Transaction.validate(req.body);
    if (errors.length > 0) {
      return res.status(400).json({
        success: false,
        errors: errors
      });
    }
    
    const transaction = new Transaction(
      'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
      req.body.amount,
      req.body.category,
      req.body.description,
      req.body.date,
      req.body.type,
      req.body.currency || 'EUR'
    );
    
    // 设置汇率（相对于欧元）
    const exchangeRates = {
      'EUR': 1.0,
      'CHF': 1.05,  // 1 CHF = 1.05 EUR
      'USD': 1.18,  // 1 USD = 1.18 EUR  
      'CNY': 0.13   // 1 CNY = 0.13 EUR
    };
    
    const rate = exchangeRates[transaction.currency] || 1.0;
    transaction.setExchangeRate(rate);
    
    console.log(`货币转换: ${transaction.amount} ${transaction.currency} -> ${transaction.amountInEUR} EUR (汇率: ${rate})`);
    
    const result = await db.addTransaction(transaction);
    
    res.status(201).json({
      success: true,
      data: transaction,
      message: '交易记录添加成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Apple Pay智能交易处理
app.post('/api/transactions/apple-pay', async (req, res) => {
  try {
    const result = await smartApplePayProcessor.processSmartApplePayTransaction(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    await db.addTransaction({
      ...result.transaction.toJSON(),
      source: 'smart_apple_pay',
      confidence: result.confidence
    });
    
    res.json({
      success: true,
      data: result.transaction,
      confidence: result.confidence,
      metadata: result.metadata,
      message: `Apple Pay智能识别成功 (置信度: ${result.confidence}%)`
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Apple Pay智能解析测试接口
app.post('/api/transactions/apple-pay/parse', async (req, res) => {
  try {
    const { rawText } = req.body;
    const result = await smartApplePayProcessor.processSmartApplePayTransaction(rawText);
    
    res.json({
      success: true,
      parsed: result.metadata?.parsedData,
      transaction: result.transaction,
      confidence: result.confidence,
      message: '解析成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// LCL银行卡交易处理
app.post('/api/transactions/lcl-bank', async (req, res) => {
  try {
    const result = paymentProcessor.processLCLBankTransaction(req.body);
    
    if (!result.success) {
      return res.status(400).json(result);
    }
    
    await db.addTransaction({
      ...result.transaction.toJSON(),
      source: 'lcl_bank'
    });
    
    res.json({
      success: true,
      data: result.transaction,
      message: 'LCL银行卡交易处理成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// SMS短信解析
app.post('/api/sms/parse', async (req, res) => {
  try {
    const { smsContent } = req.body;
    const parsed = paymentProcessor.parseBankSMS(smsContent);
    
    if (!parsed) {
      return res.status(400).json({
        success: false,
        message: '无法解析该短信格式'
      });
    }
    
    // 自动创建交易记录
    const result = paymentProcessor.processLCLBankTransaction({
      amount: parsed.amount,
      description: parsed.merchant,
      date: new Date().toISOString()
    });
    
    if (result.success) {
      await db.addTransaction({
        ...result.transaction.toJSON(),
        source: 'sms_auto'
      });
    }
    
    res.json({
      success: true,
      parsed: parsed,
      transaction: result.transaction,
      message: '短信解析并记录成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取余额
app.get('/api/balance', async (req, res) => {
  try {
    const balance = await db.getBalance();
    res.json({
      success: true,
      data: balance
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取分类统计
app.get('/api/stats/categories', async (req, res) => {
  try {
    const { start_date, end_date, type } = req.query;
    const stats = await db.getCategoryStats(
      start_date || '2020-01-01',
      end_date || new Date().toISOString(),
      type
    );
    
    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// iOS快捷指令配置
app.get('/api/ios/shortcuts', (req, res) => {
  res.json(iOSService.generateShortcutConfig());
});

// Widget端点
app.get('/widget/today-expenses', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const tomorrow = new Date(Date.now() + 24*60*60*1000).toISOString().split('T')[0];
    
    const transactions = await db.getTransactionsByDateRange(today, tomorrow);
    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    res.json({
      date: today,
      totalExpenses: totalExpenses,
      transactionCount: transactions.length,
      transactions: transactions.slice(0, 5)
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 删除交易记录
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const result = await db.deleteTransaction(req.params.id);
    
    if (result.changes === 0) {
      return res.status(404).json({
        success: false,
        message: '交易记录未找到'
      });
    }
    
    res.json({
      success: true,
      message: '交易记录删除成功'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 主页面
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// 错误处理中间件
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    error: '服务器内部错误'
  });
});

// 404处理
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: '接口不存在'
  });
});

// 启动服务器
app.listen(port, '0.0.0.0', () => {
  console.log(`自动记账应用运行在端口 ${port}`);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('支持功能:');
  console.log('- Apple Pay 自动记账');
  console.log('- LCL银行卡交易处理');
  console.log('- 短信自动解析');
  console.log('- iOS快捷指令集成');
  console.log('- PWA支持');
}).on('error', (err) => {
  console.error('服务器启动失败:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGINT', () => {
  console.log('\n正在关闭服务器...');
  db.close();
  process.exit(0);
});