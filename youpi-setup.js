const crypto = require('crypto');
const Database = require('better-sqlite3');

const db = new Database('./youpi-pg-repo/data/youpi_pg.sqlite');

const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all();
console.log('Tables in YouPI DB:', tables.map(t => t.name));

// 1. Set Merchant API Key and Webhook URL
const merchantId = '00000000-0000-0000-0000-000000000001';
const apiKey = 'mk_live_kpcyber_secret_key_2026';
const apiKeyHash = crypto.scryptSync(apiKey, 'youpi_merchant_api_key_salt_v1', 32).toString('hex');

db.prepare(`
  UPDATE merchants 
  SET api_key_hash = ?, 
      webhook_url = ?,
      contact_email = 'admin@kpcyber.com',
      contact_phone = '9876543210'
  WHERE id = ?
`).run(apiKeyHash, 'http://localhost:3000/api/webhooks/youpi', merchantId);

// 2. Insert Active Android Observer device with fresh heartbeat
db.prepare(`
  INSERT OR REPLACE INTO android_devices (id, merchant_id, device_name, device_model, signing_key_hash, is_active, last_heartbeat_at, created_at)
  VALUES ('dev-kpcyber', ?, 'KP Cyber Observer', 'Pixel 8', 'device-key-hash', 1, datetime('now'), datetime('now'))
`).run(merchantId);

// 3. Update VPA in payment_receiving_accounts
db.prepare(`
  UPDATE payment_receiving_accounts 
  SET upi_id = 'pratikkarthiya6@oksbi', payee_name = 'Pratik Karthiya', is_active = 1, is_merchant_enabled = 1
  WHERE merchant_id = ?
`).run(merchantId);

console.log('✓ Successfully configured Merchant, VPA & Android Observer Heartbeat!');
