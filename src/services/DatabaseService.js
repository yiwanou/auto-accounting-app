const sqlite3 = require('sqlite3').verbose();
const path = require('path');

class DatabaseService {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/accounting.db');
    this.db = null;
    this.init();
  }

  init() {
    // 确保数据目录存在
    const fs = require('fs');
    const dataDir = path.dirname(this.dbPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    this.db = new sqlite3.Database(this.dbPath, (err) => {
      if (err) {
        console.error('数据库连接失败:', err.message);
      } else {
        console.log('数据库连接成功');
        this.createTables();
      }
    });
  }

  createTables() {
    const createTransactionsTable = `
      CREATE TABLE IF NOT EXISTS transactions (
        id TEXT PRIMARY KEY,
        amount REAL NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        date TEXT NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        currency TEXT DEFAULT 'EUR',
        exchange_rate REAL DEFAULT 1,
        amount_in_eur REAL NOT NULL,
        source TEXT DEFAULT 'manual',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createCategoriesTable = `
      CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        type TEXT NOT NULL CHECK(type IN ('income', 'expense')),
        color TEXT DEFAULT '#007AFF',
        icon TEXT DEFAULT 'folder',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    const createBudgetsTable = `
      CREATE TABLE IF NOT EXISTS budgets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        category TEXT NOT NULL,
        amount REAL NOT NULL,
        period TEXT DEFAULT 'monthly',
        start_date TEXT NOT NULL,
        end_date TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `;

    this.db.serialize(() => {
      this.db.run(createTransactionsTable);
      this.db.run(createCategoriesTable);
      this.db.run(createBudgetsTable);
      this.insertDefaultCategories();
    });
  }

  insertDefaultCategories() {
    const defaultCategories = [
      { name: '餐饮', type: 'expense', color: '#FF6B6B', icon: 'utensils' },
      { name: '交通', type: 'expense', color: '#4ECDC4', icon: 'car' },
      { name: '娱乐', type: 'expense', color: '#45B7D1', icon: 'gamepad' },
      { name: '日用品', type: 'expense', color: '#96CEB4', icon: 'shopping-cart' },
      { name: '医疗', type: 'expense', color: '#FCEA2B', icon: 'heartbeat' },
      { name: '服装', type: 'expense', color: '#FF8A80', icon: 'tshirt' },
      { name: '教育', type: 'expense', color: '#A8E6CF', icon: 'book' },
      { name: '其他', type: 'expense', color: '#D3D3D3', icon: 'ellipsis' },
      { name: '工资', type: 'income', color: '#90EE90', icon: 'money-bill' },
      { name: '投资收益', type: 'income', color: '#98FB98', icon: 'chart-line' },
      { name: '其他收入', type: 'income', color: '#F0FFF0', icon: 'plus-circle' }
    ];

    const insertCategory = `INSERT OR IGNORE INTO categories (name, type, color, icon) VALUES (?, ?, ?, ?)`;
    
    defaultCategories.forEach(category => {
      this.db.run(insertCategory, [category.name, category.type, category.color, category.icon]);
    });
  }

  // 添加交易记录
  addTransaction(transaction) {
    return new Promise((resolve, reject) => {
      const sql = `
        INSERT INTO transactions (id, amount, category, description, date, type, currency, exchange_rate, amount_in_eur, source)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `;
      
      this.db.run(sql, [
        transaction.id,
        transaction.amount,
        transaction.category,
        transaction.description,
        transaction.date,
        transaction.type,
        transaction.currency || 'EUR',
        transaction.exchangeRate || 1,
        transaction.amountInEUR || transaction.amount,
        transaction.source || 'manual'
      ], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ id: transaction.id, changes: this.changes });
        }
      });
    });
  }

  // 获取所有交易记录
  getAllTransactions(limit = 100, offset = 0) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM transactions 
        ORDER BY date DESC, created_at DESC 
        LIMIT ? OFFSET ?
      `;
      
      this.db.all(sql, [limit, offset], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 根据日期范围获取交易记录
  getTransactionsByDateRange(startDate, endDate) {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT * FROM transactions 
        WHERE date BETWEEN ? AND ?
        ORDER BY date DESC
      `;
      
      this.db.all(sql, [startDate, endDate], (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 获取分类统计
  getCategoryStats(startDate, endDate, type = null) {
    return new Promise((resolve, reject) => {
      let sql = `
        SELECT 
          category,
          SUM(amount) as total,
          COUNT(*) as count,
          AVG(amount) as average
        FROM transactions 
        WHERE date BETWEEN ? AND ?
      `;
      
      const params = [startDate, endDate];
      
      if (type) {
        sql += ' AND type = ?';
        params.push(type);
      }
      
      sql += ' GROUP BY category ORDER BY total DESC';
      
      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows);
        }
      });
    });
  }

  // 获取余额
  getBalance() {
    return new Promise((resolve, reject) => {
      const sql = `
        SELECT 
          SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
          SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expense
        FROM transactions
      `;
      
      this.db.get(sql, [], (err, row) => {
        if (err) {
          reject(err);
        } else {
          const balance = (row.total_income || 0) - (row.total_expense || 0);
          resolve({
            balance: balance,
            income: row.total_income || 0,
            expense: row.total_expense || 0
          });
        }
      });
    });
  }

  // 删除交易记录
  deleteTransaction(id) {
    return new Promise((resolve, reject) => {
      const sql = 'DELETE FROM transactions WHERE id = ?';
      
      this.db.run(sql, [id], function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // 更新交易记录
  updateTransaction(id, updates) {
    return new Promise((resolve, reject) => {
      const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
      const values = Object.values(updates);
      values.push(id);
      
      const sql = `UPDATE transactions SET ${fields}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`;
      
      this.db.run(sql, values, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({ changes: this.changes });
        }
      });
    });
  }

  // 关闭数据库连接
  close() {
    if (this.db) {
      this.db.close((err) => {
        if (err) {
          console.error('关闭数据库时出错:', err.message);
        } else {
          console.log('数据库连接已关闭');
        }
      });
    }
  }
}

module.exports = DatabaseService;