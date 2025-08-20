// 数据库清理脚本
const { pool } = require('./src/database');

async function cleanupDatabase() {
  const client = await pool.connect();
  try {
    console.log('开始清理数据库...');
    
    // 删除所有交易记录
    const deleteResult = await client.query('DELETE FROM transactions');
    console.log(`已删除 ${deleteResult.rowCount} 条交易记录`);
    
    // 重置序列（如果有的话）
    await client.query('ALTER SEQUENCE IF EXISTS transactions_id_seq RESTART WITH 1');
    
    // 插入一些新的示例数据
    const sampleData = [
      {
        amount: 25.50,
        category: '餐饮',
        description: 'Starbucks 咖啡',
        date: '2025-08-20',
        type: 'expense',
        currency: 'CHF',
        exchange_rate: 1.05,
        amount_in_eur: 26.78
      },
      {
        amount: 1200.00,
        category: '工资',
        description: '月薪',
        date: '2025-08-19',
        type: 'income',
        currency: 'EUR',
        exchange_rate: 1.0,
        amount_in_eur: 1200.00
      },
      {
        amount: 45.80,
        category: '日用品',
        description: 'Migros 购物',
        date: '2025-08-19',
        type: 'expense',
        currency: 'CHF',
        exchange_rate: 1.05,
        amount_in_eur: 48.09
      },
      {
        amount: 12.40,
        category: '交通',
        description: 'SBB 火车票',
        date: '2025-08-18',
        type: 'expense',
        currency: 'CHF',
        exchange_rate: 1.05,
        amount_in_eur: 13.02
      },
      {
        amount: 85.00,
        category: '娱乐',
        description: '电影院',
        date: '2025-08-18',
        type: 'expense',
        currency: 'EUR',
        exchange_rate: 1.0,
        amount_in_eur: 85.00
      }
    ];
    
    console.log('插入示例数据...');
    for (const data of sampleData) {
      await client.query(`
        INSERT INTO transactions (amount, category, description, date, type, currency, exchange_rate, amount_in_eur)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [data.amount, data.category, data.description, data.date, data.type, data.currency, data.exchange_rate, data.amount_in_eur]);
    }
    
    console.log(`已插入 ${sampleData.length} 条示例数据`);
    
    // 验证数据
    const countResult = await client.query('SELECT COUNT(*) as total FROM transactions');
    console.log(`数据库中共有 ${countResult.rows[0].total} 条记录`);
    
    console.log('数据库清理完成！');
    
  } catch (error) {
    console.error('数据库清理失败:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}

// 确认提示
console.log('⚠️  警告：此操作将删除所有交易记录！');
console.log('按 Ctrl+C 取消，或等待 5 秒自动开始...');

setTimeout(() => {
  cleanupDatabase();
}, 5000);