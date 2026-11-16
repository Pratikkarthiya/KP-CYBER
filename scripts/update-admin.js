const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const dbPath = path.join(__dirname, '../kp_cyber.db');
const db = new Database(dbPath);

const adminLogin = process.env.ADMIN_LOGIN || 'pratikarthiya6';
const adminPass = process.env.ADMIN_PASSWORD || 'pratik3361';
const adminHash = bcrypt.hashSync(adminPass, 10);

const existingAdmin = db.prepare("SELECT * FROM users WHERE role = 'ADMIN'").get();

if (existingAdmin) {
  db.prepare(`
    UPDATE users 
    SET phone = ?, name = ?, email = ?, password_hash = ?
    WHERE role = 'ADMIN'
  `).run(adminLogin, 'Pratik Karthiya', `${adminLogin}@gmail.com`, adminHash);
  console.log(`✓ Admin updated successfully to ID: ${adminLogin}`);
} else {
  db.prepare(`
    INSERT INTO users (phone, name, email, password_hash, role, status, rate, wallet_balance, approved_at)
    VALUES (?, ?, ?, ?, 'ADMIN', 'APPROVED', 0, 99999, CURRENT_TIMESTAMP)
  `).run(adminLogin, 'Pratik Karthiya', `${adminLogin}@gmail.com`, adminHash);
  console.log(`✓ Admin created successfully with ID: ${adminLogin}`);
}
