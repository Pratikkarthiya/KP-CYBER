const Database = require('better-sqlite3');
const path = require('path');

// 1. Update KP Cyber database
const kpDb = new Database(path.join(__dirname, '../kp_cyber.db'));
kpDb.prepare("UPDATE system_settings SET value = 'pratikkarthiya6@oksbi' WHERE key = 'upi_id'").run();
kpDb.prepare("UPDATE system_settings SET value = 'Pratik Karthiya' WHERE key = 'upi_name'").run();

// Ensure both keys exist in case they weren't in system_settings
kpDb.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('upi_id', 'pratikkarthiya6@oksbi')").run();
kpDb.prepare("INSERT OR IGNORE INTO system_settings (key, value) VALUES ('upi_name', 'Pratik Karthiya')").run();

const upiSettings = kpDb.prepare("SELECT * FROM system_settings WHERE key IN ('upi_id', 'upi_name')").all();
console.log('✓ KP Cyber system_settings:', upiSettings);

// 2. Update YouPI-PG receiving accounts
const youpiDb = new Database(path.join(__dirname, '../youpi-pg-repo/data/youpi_pg.sqlite'));
const updateRes = youpiDb.prepare(`
  UPDATE payment_receiving_accounts 
  SET upi_id = 'pratikkarthiya6@oksbi', 
      payee_name = 'Pratik Karthiya', 
      is_active = 1, 
      is_merchant_enabled = 1
`).run();
console.log('✓ YouPI-PG payment_receiving_accounts updated count:', updateRes.changes);

const accounts = youpiDb.prepare("SELECT id, merchant_id, upi_id, payee_name, is_active FROM payment_receiving_accounts").all();
console.log('✓ YouPI Active Receiving Accounts:', accounts);

console.log('\n🎉 Successfully set UPI ID pratikkarthiya6@oksbi across KP Cyber and YouPI-PG Gateway!');
