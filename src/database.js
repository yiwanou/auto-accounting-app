const { Pool } = require('pg');
require('dotenv').config();

// 安全的数据库连接配置
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // 最大连接数
  idleTimeoutMillis: 30000, // 空闲连接超时
  connectionTimeoutMillis: 2000, // 连接超时
});

// 连接错误处理
pool.on('error', (err, client) => {
  console.error('Unexpected error on idle client', err);
  process.exit(-1);
});

// 数据库初始化
async function initDatabase() {
  const client = await pool.connect();
  try {
    // 检查表是否存在，如果不存在则创建
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'transactions'
      );
    `);
    
    if (!tableExists.rows[0].exists) {
      console.log('创建数据库表...');
      const fs = require('fs');
      const path = require('path');
      const sqlScript = fs.readFileSync(path.join(__dirname, '../database.sql'), 'utf8');
      await client.query(sqlScript);
      console.log('数据库表创建成功');
    } else {
      console.log('数据库表已存在');
    }
  } catch (error) {
    console.error('数据库初始化错误:', error);
    throw error;
  } finally {
    client.release();
  }
}

// 安全查询函数，防止SQL注入
async function query(text, params) {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('executed query', { text, duration, rows: res.rowCount });
    return res;
  } catch (error) {
    console.error('数据库查询错误:', error);
    throw error;
  }
}

// 获取数据库客户端
async function getClient() {
  return await pool.connect();
}

// 交易记录相关查询
const TransactionQueries = {
  // 获取所有交易记录（带分页）
  async getAll(limit = 100, offset = 0, startDate = null, endDate = null) {
    let queryText = `
      SELECT id, amount, category, description, date, type, currency, 
             exchange_rate, amount_in_eur, created_at, updated_at
      FROM transactions
    `;
    const params = [];
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push(`date >= $${params.length + 1} AND date < $${params.length + 2}`);
      params.push(startDate, endDate);
    }
    
    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    queryText += ` ORDER BY date DESC, created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(limit, offset);
    
    return await query(queryText, params);
  },
  
  // 获取交易记录总数
  async getCount(startDate = null, endDate = null) {
    let queryText = 'SELECT COUNT(*) as total FROM transactions';
    const params = [];
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push(`date >= $1 AND date < $2`);
      params.push(startDate, endDate);
    }
    
    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    const result = await query(queryText, params);
    return parseInt(result.rows[0].total);
  },
  
  // 创建交易记录
  async create(transactionData) {
    const { amount, category, description, date, type, currency, exchange_rate, amount_in_eur } = transactionData;
    
    const queryText = `
      INSERT INTO transactions (amount, category, description, date, type, currency, exchange_rate, amount_in_eur)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `;
    
    return await query(queryText, [amount, category, description, date, type, currency, exchange_rate, amount_in_eur]);
  },
  
  // 删除交易记录
  async delete(id) {
    const queryText = 'DELETE FROM transactions WHERE id = $1 RETURNING *';
    return await query(queryText, [id]);
  },
  
  // 根据ID获取单个交易记录
  async getById(id) {
    const queryText = `
      SELECT id, amount, category, description, date, type, currency, 
             exchange_rate, amount_in_eur, created_at, updated_at
      FROM transactions 
      WHERE id = $1
    `;
    return await query(queryText, [id]);
  },
  
  // 更新交易记录
  async update(id, transactionData) {
    const { amount, category, description, date, type, currency, exchange_rate, amount_in_eur } = transactionData;
    
    const queryText = `
      UPDATE transactions 
      SET amount = $2, category = $3, description = $4, date = $5, 
          type = $6, currency = $7, exchange_rate = $8, amount_in_eur = $9,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING *
    `;
    
    return await query(queryText, [id, amount, category, description, date, type, currency, exchange_rate, amount_in_eur]);
  },
  
  // 获取余额统计
  async getBalance() {
    const queryText = `
      SELECT 
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_in_eur ELSE 0 END), 0) as income,
        COALESCE(SUM(CASE WHEN type = 'expense' THEN amount_in_eur ELSE 0 END), 0) as expense,
        COALESCE(SUM(CASE WHEN type = 'income' THEN amount_in_eur ELSE -amount_in_eur END), 0) as balance
      FROM transactions
    `;
    
    return await query(queryText);
  },
  
  // 获取按类别统计
  async getCategoryStats(startDate = null, endDate = null) {
    let queryText = `
      SELECT category, type,
        COUNT(*) as count,
        SUM(amount_in_eur) as total_amount
      FROM transactions
    `;
    
    const params = [];
    const conditions = [];
    
    if (startDate && endDate) {
      conditions.push(`date >= $1 AND date < $2`);
      params.push(startDate, endDate);
    }
    
    if (conditions.length > 0) {
      queryText += ` WHERE ${conditions.join(' AND ')}`;
    }
    
    queryText += ` GROUP BY category, type ORDER BY total_amount DESC`;
    
    return await query(queryText, params);
  }
};

module.exports = {
  query,
  getClient,
  initDatabase,
  TransactionQueries,
  pool
};