-- 自动记账应用数据库模式
-- 安全性：使用UUID作为主键，添加索引，数据验证约束

-- 创建扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 交易记录表
CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    amount DECIMAL(12, 2) NOT NULL CHECK (amount > 0),
    category VARCHAR(50) NOT NULL CHECK (length(category) > 0),
    description TEXT NOT NULL CHECK (length(description) > 0 AND length(description) <= 200),
    date DATE NOT NULL,
    type VARCHAR(10) NOT NULL CHECK (type IN ('income', 'expense')),
    currency VARCHAR(3) NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'CHF', 'USD', 'CNY')),
    exchange_rate DECIMAL(8, 4) NOT NULL DEFAULT 1.0000 CHECK (exchange_rate > 0),
    amount_in_eur DECIMAL(12, 2) NOT NULL CHECK (amount_in_eur > 0),
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 创建索引提高查询性能
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_currency ON transactions(currency);

-- 创建更新时间触发器
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 应用触发器
DROP TRIGGER IF EXISTS update_transactions_updated_at ON transactions;
CREATE TRIGGER update_transactions_updated_at
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- 插入一些安全的示例数据
INSERT INTO transactions (amount, category, description, date, type, currency, exchange_rate, amount_in_eur) VALUES
(25.50, '餐饮', 'Starbucks 咖啡', '2025-08-20', 'expense', 'CHF', 1.0500, 26.78),
(1200.00, '工资', '月薪', '2025-08-19', 'income', 'EUR', 1.0000, 1200.00),
(45.80, '日用品', 'Migros 购物', '2025-08-19', 'expense', 'CHF', 1.0500, 48.09),
(12.40, '交通', 'SBB 火车票', '2025-08-18', 'expense', 'CHF', 1.0500, 13.02),
(85.00, '娱乐', '电影院', '2025-08-18', 'expense', 'EUR', 1.0000, 85.00)
ON CONFLICT (id) DO NOTHING;

-- 安全策略：创建只读用户（可选）
-- CREATE ROLE readonly_user WITH LOGIN PASSWORD 'secure_password_here';
-- GRANT SELECT ON transactions TO readonly_user;