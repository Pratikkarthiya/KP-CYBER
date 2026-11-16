const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = path.join(__dirname, 'kp_cyber.db');
const db = new Database(dbPath);

// Enable WAL mode for high concurrency
db.pragma('journal_mode = WAL');

// Initialize database schema
function initDB() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      email TEXT,
      password_hash TEXT,
      role TEXT DEFAULT 'USER', -- 'USER', 'ADMIN'
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED', 'BLOCKED'
      rate REAL DEFAULT 50.00, -- Rate per submission assigned by admin
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
      payment_method TEXT DEFAULT 'UPI', -- 'UPI', 'YOUPI_PG'
      gateway_payment_id TEXT,
      gateway_status TEXT, -- 'INITIATED', 'ACTIVE', 'SUCCESS', 'MANUAL_REVIEW', 'FAILED', 'EXPIRED'
      screenshot_path TEXT,
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'APPROVED', 'REJECTED'
      admin_remarks TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      processed_at DATETIME,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS wallet_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL, -- 'CREDIT', 'DEBIT'
      amount REAL NOT NULL,
      balance_after REAL NOT NULL,
      category TEXT NOT NULL, -- 'TOPUP', 'SUBMISSION_FEE', 'REFUND', 'MANUAL_ADJUSTMENT'
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
      status TEXT DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'
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
  `);

  // Migration: Add columns to topups if missing in existing DB
  const tableInfo = db.prepare("PRAGMA table_info(topups)").all();
  const columnNames = tableInfo.map(c => c.name);

  if (!columnNames.includes('order_id')) {
    db.exec("ALTER TABLE topups ADD COLUMN order_id TEXT;");
  }
  if (!columnNames.includes('gateway_payment_id')) {
    db.exec("ALTER TABLE topups ADD COLUMN gateway_payment_id TEXT;");
  }
  if (!columnNames.includes('gateway_status')) {
    db.exec("ALTER TABLE topups ADD COLUMN gateway_status TEXT;");
  }

  // Default settings
  const insertSetting = db.prepare(`
    INSERT OR IGNORE INTO system_settings (key, value) VALUES (?, ?)
  `);
  insertSetting.run('default_rate', '50.00');
  insertSetting.run('upi_id', 'pratikkarthiya6@oksbi');
  insertSetting.run('upi_name', 'Pratik Karthiya');
  insertSetting.run('portal_name', 'KP Cyber Service Portal');
  insertSetting.run('support_phone', '+91 98765 43210');

  // YouPI Payment Gateway Settings
  insertSetting.run('youpi_api_url', 'http://localhost:7000');
  insertSetting.run('youpi_merchant_id', '00000000-0000-0000-0000-000000000001');
  insertSetting.run('youpi_merchant_api_key', 'yp_test_key_kpcyber_2026');
  insertSetting.run('youpi_webhook_secret', 'yp_whsec_kpcyber_2026');

  // SMS Gateway Settings
  insertSetting.run('sms_provider', 'SIMULATOR'); // 'SIMULATOR', 'FAST2SMS', 'TWOFACTOR', 'TWILIO'
  insertSetting.run('fast2sms_api_key', '');
  insertSetting.run('twofactor_api_key', '');
  insertSetting.run('twilio_account_sid', '');
  insertSetting.run('twilio_auth_token', '');
  insertSetting.run('twilio_from_phone', '');

  // Ensure Admin exists
  const bcrypt = require('bcryptjs');
  const adminLogin = process.env.ADMIN_LOGIN || 'pratikarthiya6';
  const adminPass = process.env.ADMIN_PASSWORD || 'pratik3361';
  const adminPassHash = bcrypt.hashSync(adminPass, 10);
  const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();
  if (!existingAdmin) {
    db.prepare(`
      INSERT INTO users (phone, name, email, password_hash, role, status, rate, wallet_balance, approved_at)
      VALUES (?, ?, ?, ?, 'ADMIN', 'APPROVED', 0, 99999, CURRENT_TIMESTAMP)
    `).run(adminLogin, 'Pratik Karthiya', `${adminLogin}@gmail.com`, adminPassHash);
    console.log('✓ Admin account configured.');
  } else if (existingAdmin.phone === '9876543210') {
    db.prepare(`
      UPDATE users SET phone = ?, name = ?, email = ?, password_hash = ? WHERE id = ?
    `).run(adminLogin, 'Pratik Karthiya', `${adminLogin}@gmail.com`, adminPassHash, existingAdmin.id);
    console.log('✓ Admin credentials upgraded.');
  }

  // Ensure uploads directory exists
  const uploadDir = path.join(__dirname, 'uploads');
  if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
  }

  console.log('✓ Database tables and schema verified with YouPI Payment Gateway.');
}

module.exports = {
  db,
  initDB
};
