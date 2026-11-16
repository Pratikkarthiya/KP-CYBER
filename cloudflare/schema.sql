-- Cloudflare D1 Database Schema for KP Cyber
-- To apply: npx wrangler d1 execute kp-cyber-db --file=cloudflare/schema.sql

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  password_hash TEXT,
  role TEXT DEFAULT 'USER',
  status TEXT DEFAULT 'PENDING',
  rate REAL DEFAULT 50.00,
  wallet_balance REAL DEFAULT 0.00,
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  approved_at DATETIME
);

CREATE TABLE IF NOT EXISTS otps (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phone TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  verified INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS topups (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT UNIQUE,
  user_id INTEGER NOT NULL,
  amount REAL NOT NULL,
  utr TEXT,
  payment_method TEXT DEFAULT 'YOUPI_PG',
  gateway_payment_id TEXT,
  gateway_status TEXT,
  screenshot_path TEXT,
  status TEXT DEFAULT 'PENDING',
  admin_remarks TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  processed_at DATETIME,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  category TEXT NOT NULL,
  reference_id TEXT,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS submissions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tracking_id TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL,
  application_no TEXT NOT NULL,
  dob TEXT NOT NULL,
  password TEXT NOT NULL,
  service_type TEXT NOT NULL,
  service_rate REAL NOT NULL,
  user_notes TEXT,
  status TEXT DEFAULT 'PENDING',
  admin_remarks TEXT,
  result_file TEXT,
  result_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

-- Default settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('default_rate', '50.00');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('upi_id', 'kpcyber@upi');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('upi_name', 'KP Cyber Services');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('portal_name', 'KP Cyber Service Portal');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('support_phone', '+91 98765 43210');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('youpi_api_url', 'http://localhost:7000');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('youpi_merchant_id', '00000000-0000-0000-0000-000000000001');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('youpi_merchant_api_key', 'yp_test_key_kpcyber_2026');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('youpi_webhook_secret', 'yp_whsec_kpcyber_2026');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('sms_provider', 'FAST2SMS');
