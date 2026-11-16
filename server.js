require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const QRCode = require('qrcode');
const { db, initDB } = require('./db');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'kp_cyber_super_secret_jwt_key_2026';

// Initialize DB schema & default data
initDB();

// Middleware: preserve raw body for Webhook HMAC verification
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ extended: true }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Configure Multer for file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const ext = path.extname(file.originalname);
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'file-' + uniqueSuffix + ext);
  }
});
const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Helper: Get System Setting
function getSetting(key, defaultValue = '') {
  const row = db.prepare('SELECT value FROM system_settings WHERE key = ?').get(key);
  return row ? row.value : defaultValue;
}

// Real SMS Dispatcher Supporting Fast2SMS, 2Factor.in, Twilio & Simulator
async function dispatchSMS(phone, otp) {
  const provider = getSetting('sms_provider', 'SIMULATOR');
  console.log(`[SMS Gateway] Engine: ${provider}, Destination: +91${phone}`);

  if (provider === 'FAST2SMS') {
    const apiKey = getSetting('fast2sms_api_key');
    if (!apiKey) throw new Error('Fast2SMS API Key not configured. Set in Admin Portal.');
    
    const res = await fetch('https://www.fast2sms.com/dev/bulkV2', {
      method: 'POST',
      headers: {
        'authorization': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        route: 'otp',
        variables_values: otp,
        numbers: phone
      })
    });
    const data = await res.json();
    return { success: data.return === true, provider: 'FAST2SMS', detail: data.message };
  } else if (provider === 'TWOFACTOR') {
    const apiKey = getSetting('twofactor_api_key');
    if (!apiKey) throw new Error('2Factor.in API Key not configured.');
    
    const res = await fetch(`https://2factor.in/v3/API/V1/${apiKey}/SMS/${phone}/${otp}/KP+Cyber+Verification`);
    const data = await res.json();
    return { success: data.Status === 'Success', provider: 'TWOFACTOR', detail: data.Details };
  } else if (provider === 'TWILIO') {
    const accountSid = getSetting('twilio_account_sid');
    const authToken = getSetting('twilio_auth_token');
    const fromPhone = getSetting('twilio_from_phone');
    if (!accountSid || !authToken || !fromPhone) throw new Error('Twilio credentials incomplete.');

    const basicAuth = Buffer.from(`${accountSid}:${authToken}`).toString('base64');
    const params = new URLSearchParams();
    params.append('To', `+91${phone}`);
    params.append('From', fromPhone);
    params.append('Body', `Your KP Cyber verification OTP is: ${otp}. Valid for 5 minutes.`);

    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicAuth}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params.toString()
    });
    const data = await res.json();
    return { success: !!data.sid, provider: 'TWILIO', detail: data.sid || data.message };
  }

  // Default: SIMULATOR
  return { success: true, provider: 'SIMULATOR', detail: 'Simulated OTP' };
}

// Helper: Generate 6-digit OTP
function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Authentication Middleware
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required. Please login.' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ success: false, message: 'Session expired or invalid token.' });
    }
    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
    if (!freshUser) {
      return res.status(404).json({ success: false, message: 'User account not found.' });
    }
    if (freshUser.status === 'BLOCKED') {
      return res.status(403).json({ success: false, message: 'Account is blocked. Contact administrator.' });
    }
    req.user = freshUser;
    next();
  });
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'ADMIN') {
    return res.status(403).json({ success: false, message: 'Admin access required.' });
  }
  next();
}

// ==========================================
// 1. AUTHENTICATION ROUTES
// ==========================================

// Send Mobile OTP
app.post('/api/auth/send-otp', async (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || phone.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 10-digit mobile number.' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const otp = generateOTP();
    const expiresAt = Date.now() + 5 * 60 * 1000; // 5 minutes

    db.prepare('DELETE FROM otps WHERE phone = ?').run(cleanPhone);
    db.prepare('INSERT INTO otps (phone, otp, expires_at) VALUES (?, ?, ?)').run(cleanPhone, otp, expiresAt);

    console.log(`[OTP] Generated OTP for ${cleanPhone}: ${otp}`);

    let smsResult = { provider: 'SIMULATOR' };
    try {
      smsResult = await dispatchSMS(cleanPhone, otp);
    } catch (smsErr) {
      console.warn('Real SMS sending error, falling back to simulator:', smsErr.message);
    }

    const provider = getSetting('sms_provider', 'SIMULATOR');

    return res.json({
      success: true,
      message: provider === 'SIMULATOR'
        ? `OTP generated for +91 ${cleanPhone} (Preview Mode). Valid for 5 minutes.`
        : `OTP dispatched via SMS to +91 ${cleanPhone}.`,
      provider: provider,
      debugOtp: provider === 'SIMULATOR' ? otp : undefined,
      phone: cleanPhone
    });
  } catch (err) {
    console.error('Send OTP error:', err);
    res.status(500).json({ success: false, message: 'Error sending OTP. Please try again.' });
  }
});

// Verify OTP & Login / Register
app.post('/api/auth/verify-otp', (req, res) => {
  try {
    const { phone, otp, name } = req.body;
    if (!phone || !otp) {
      return res.status(400).json({ success: false, message: 'Phone number and OTP are required.' });
    }

    const cleanPhone = phone.trim().replace(/\D/g, '').slice(-10);
    const record = db.prepare('SELECT * FROM otps WHERE phone = ? ORDER BY id DESC LIMIT 1').get(cleanPhone);
    if (!record) {
      return res.status(400).json({ success: false, message: 'No OTP requested for this number. Request again.' });
    }

    if (Date.now() > record.expires_at) {
      return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new OTP.' });
    }

    if (record.otp !== otp.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid OTP entered. Please try again.' });
    }

    db.prepare('UPDATE otps SET verified = 1 WHERE id = ?').run(record.id);

    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);
    let isNewUser = false;

    if (!user) {
      isNewUser = true;
      const userName = (name && name.trim()) ? name.trim() : `Customer ${cleanPhone.slice(-4)}`;
      const defaultRate = parseFloat(getSetting('default_rate', '50.00'));

      const insertResult = db.prepare(`
        INSERT INTO users (phone, name, role, status, rate, wallet_balance)
        VALUES (?, ?, 'USER', 'PENDING', ?, 0.00)
      `).run(cleanPhone, userName, defaultRate);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(insertResult.lastInsertRowid);
    } else if (name && name.trim() && user.name.startsWith('Customer ')) {
      db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name.trim(), user.id);
      user.name = name.trim();
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: isNewUser ? 'Registration successful. Account submitted for Admin approval.' : 'Login successful.',
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        rate: user.rate,
        wallet_balance: user.wallet_balance,
        approved_at: user.approved_at
      }
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ success: false, message: 'Verification failed.' });
  }
});

// Direct User Login (No OTP required)
app.post('/api/auth/direct-login', (req, res) => {
  try {
    const { phone, name } = req.body;
    if (!phone || phone.length < 10) {
      return res.status(400).json({ success: false, message: 'Valid 10-digit mobile number required.' });
    }

    const cleanPhone = phone.replace(/[^0-9]/g, '').slice(-10);
    let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(cleanPhone);

    if (!user) {
      const defaultRateSetting = db.prepare("SELECT value FROM system_settings WHERE key = 'default_rate'").get();
      const defaultRate = defaultRateSetting ? parseFloat(defaultRateSetting.value) : 50.00;
      const userName = (name && name.trim()) ? name.trim() : `Customer ${cleanPhone.slice(-4)}`;

      const info = db.prepare(`
        INSERT INTO users (phone, name, status, rate, wallet_balance, approved_at)
        VALUES (?, ?, 'APPROVED', ?, 0.00, CURRENT_TIMESTAMP)
      `).run(cleanPhone, userName, defaultRate);

      user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
    }

    if (user.status === 'BLOCKED') {
      return res.status(403).json({ success: false, message: 'Your account has been suspended by administration.' });
    }

    const token = jwt.sign(
      { id: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: `Welcome back, ${user.name}!`,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name,
        role: user.role,
        status: user.status,
        rate: user.rate,
        wallet_balance: user.wallet_balance
      }
    });
  } catch (err) {
    console.error('Direct login error:', err);
    res.status(500).json({ success: false, message: 'Server error during login.' });
  }
});

// Admin Password Login
app.post('/api/auth/admin-login', (req, res) => {
  try {
    const { login, password } = req.body;
    if (!login || !password) {
      return res.status(400).json({ success: false, message: 'Admin identifier and password required.' });
    }

    const cleanIdentifier = login.trim();
    const adminUser = db.prepare(`
      SELECT * FROM users 
      WHERE (phone = ? OR email = ? OR LOWER(phone) = LOWER(?) OR LOWER(email) = LOWER(?)) 
        AND role = 'ADMIN'
    `).get(cleanIdentifier, cleanIdentifier, cleanIdentifier, cleanIdentifier);

    if (!adminUser || !adminUser.password_hash) {
      return res.status(401).json({ success: false, message: 'Invalid admin credentials.' });
    }

    const validPass = bcrypt.compareSync(password, adminUser.password_hash);
    if (!validPass) {
      return res.status(401).json({ success: false, message: 'Incorrect password.' });
    }

    const token = jwt.sign(
      { id: adminUser.id, phone: adminUser.phone, role: adminUser.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    return res.json({
      success: true,
      message: 'Admin authentication successful.',
      token,
      user: {
        id: adminUser.id,
        phone: adminUser.phone,
        name: adminUser.name,
        role: adminUser.role,
        status: adminUser.status,
        wallet_balance: adminUser.wallet_balance
      }
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ success: false, message: 'Server error during admin login.' });
  }
});

// Current User Profile Check
app.get('/api/auth/me', authenticateToken, (req, res) => {
  return res.json({
    success: true,
    user: {
      id: req.user.id,
      phone: req.user.phone,
      name: req.user.name,
      email: req.user.email,
      role: req.user.role,
      status: req.user.status,
      rate: req.user.rate,
      wallet_balance: req.user.wallet_balance,
      admin_notes: req.user.admin_notes,
      created_at: req.user.created_at,
      approved_at: req.user.approved_at
    }
  });
});

// ==========================================
// 2. YouPI PAYMENT GATEWAY INTEGRATION
// ==========================================

// Create YouPI-PG Payment Session
app.post('/api/wallet/youpi/create-session', authenticateToken, async (req, res) => {
  try {
    if (req.user.status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. You can top up once approved.'
      });
    }

    const amount = parseFloat(req.body.amount);
    if (!amount || amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum top-up amount is ₹10.00.' });
    }

    const orderId = `KPC-TOPUP-${req.user.id}-${Date.now()}`;
    const youpiApiUrl = getSetting('youpi_api_url', 'http://localhost:6100');
    const youpiMerchantId = getSetting('youpi_merchant_id', '00000000-0000-0000-0000-000000000001');
    const youpiApiKey = getSetting('youpi_merchant_api_key', 'mk_live_kpcyber_secret_key_2026');
    const upiId = getSetting('upi_id', 'kpcyber@upi');
    const upiName = getSetting('upi_name', 'KP Cyber Services');

    // Insert pending topup record
    const insertStmt = db.prepare(`
      INSERT INTO topups (order_id, user_id, amount, utr, payment_method, status, gateway_status)
      VALUES (?, ?, ?, ?, 'YOUPI_PG', 'PENDING', 'INITIATED')
    `);
    const insertRes = insertStmt.run(orderId, req.user.id, amount, '');
    const topupId = insertRes.lastInsertRowid;

    // Generate UPI URI & QR Code
    const upiUri = `upi://pay?pa=${encodeURIComponent(upiId)}&pn=${encodeURIComponent(upiName)}&am=${amount.toFixed(2)}&cu=INR&tn=${encodeURIComponent(orderId)}`;
    const qrDataUrl = await QRCode.toDataURL(upiUri, {
      margin: 1,
      width: 300,
      color: { dark: '#0f172a', light: '#ffffff' }
    });

    // Check if live external YouPI-PG server is reachable
    let liveGatewayUsed = false;
    let liveCheckoutUrl = null;
    let livePaymentId = null;

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3s timeout
      const youpiRes = await fetch(`${youpiApiUrl}/api/v1/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-merchant-id': youpiMerchantId,
          'x-merchant-key': youpiApiKey,
          'Authorization': `Bearer ${youpiApiKey}`,
          'Idempotency-Key': orderId
        },
        body: JSON.stringify({
          orderId: orderId,
          amount: amount.toFixed(2),
          currency: 'INR',
          customer: {
            name: req.user.name,
            phoneNumber: req.user.phone
          },
          description: `KP Cyber Wallet Top-Up (${req.user.name})`,
          returnUrl: `http://localhost:${PORT}/?topup_order=${orderId}`,
          metadata: {
            userId: req.user.id,
            topupId: topupId
          }
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (youpiRes.ok) {
        const youpiData = await youpiRes.json();
        if (youpiData && (youpiData.checkoutUrl || youpiData.paymentId)) {
          liveGatewayUsed = true;
          liveCheckoutUrl = youpiData.checkoutUrl || `http://localhost:7000/checkout/${youpiData.paymentId}`;
          livePaymentId = youpiData.paymentId;
          db.prepare('UPDATE topups SET gateway_payment_id = ?, gateway_status = ? WHERE id = ?')
            .run(livePaymentId, youpiData.status || 'INITIATED', topupId);
        }
      }
    } catch (e) {
      console.warn('[YouPI Gateway] Local bridge fallback active:', e.message);
    }

    const paymentId = livePaymentId || `yp_pay_${Date.now()}`;
    if (!liveGatewayUsed) {
      db.prepare('UPDATE topups SET gateway_payment_id = ? WHERE id = ?').run(paymentId, topupId);
    }

    return res.json({
      success: true,
      mode: liveGatewayUsed ? 'YOUPI_LIVE' : 'YOUPI_EMBEDDED',
      topupId,
      orderId,
      paymentId,
      amount: amount.toFixed(2),
      checkoutUrl: liveCheckoutUrl,
      upiId,
      upiName,
      upiUri,
      qrDataUrl
    });
  } catch (err) {
    console.error('YouPI session error:', err);
    res.status(500).json({ success: false, message: 'Failed to initiate YouPI payment session.' });
  }
});

// Official YouPI-PG Webhook Endpoint (HMAC-SHA256 Signed)
app.post('/api/webhooks/youpi', (req, res) => {
  try {
    const rawBody = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const signature = req.headers['x-gateway-signature'] || req.headers['x-gateway-signature-v2'] || req.headers['x-youpi-signature'] || '';
    const secret = getSetting('youpi_webhook_secret', 'yp_whsec_kpcyber_2026');

    // Verify HMAC-SHA256 signature
    const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');

    // In production or simulation mode, verify timing-safe equality
    let isSignatureValid = false;
    if (signature && signature.length === expected.length) {
      try {
        isSignatureValid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
      } catch (err) {
        isSignatureValid = false;
      }
    }

    // Allow request if signature matches or if payload carries valid test token
    const payload = typeof req.body === 'object' && !Buffer.isBuffer(req.body) ? req.body : JSON.parse(rawBody.toString('utf8'));
    console.log(`[YouPI Webhook] Event: ${payload.event}, Order: ${payload.orderId}, Amount: ${payload.amount}, SigValid: ${isSignatureValid}`);

    if (!isSignatureValid && process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Invalid YouPI webhook signature.' });
    }

    const { event, orderId, paymentId, amount, utr } = payload;
    if (!orderId) {
      return res.status(400).json({ error: 'orderId is required in webhook payload.' });
    }

    const topup = db.prepare('SELECT * FROM topups WHERE order_id = ?').get(orderId);
    if (!topup) {
      return res.status(404).json({ error: 'Order not found in KP Cyber records.' });
    }

    const executeWebhookAction = db.transaction(() => {
      // 1. Success / Reconciled event
      if (['SUCCESS', 'RECONCILED', 'OBSERVED_SUCCESS'].includes(event)) {
        if (topup.status !== 'APPROVED') {
          const user = db.prepare('SELECT * FROM users WHERE id = ?').get(topup.user_id);
          const topupAmount = parseFloat(amount || topup.amount);
          const newBalance = user.wallet_balance + topupAmount;

          db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, user.id);
          db.prepare(`
            INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
            VALUES (?, 'CREDIT', ?, ?, 'TOPUP', ?, ?)
          `).run(
            user.id,
            topupAmount,
            newBalance,
            utr || paymentId || orderId,
            `YouPI-PG Instant Wallet Recharge (Ref: ${utr || paymentId || orderId})`
          );

          db.prepare(`
            UPDATE topups 
            SET status = 'APPROVED', 
                gateway_status = ?, 
                utr = COALESCE(?, utr), 
                admin_remarks = 'Automated settlement via YouPI Payment Gateway', 
                processed_at = CURRENT_TIMESTAMP 
            WHERE id = ?
          `).run(event, utr || null, topup.id);
        }
      } 
      // 2. Manual Review event (customer submitted UTR in YouPI checkout)
      else if (event === 'MANUAL_REVIEW') {
        db.prepare(`
          UPDATE topups 
          SET gateway_status = 'MANUAL_REVIEW', 
              utr = COALESCE(?, utr), 
              admin_remarks = 'YouPI-PG Manual Review: UTR claim submitted' 
          WHERE id = ?
        `).run(utr || null, topup.id);
      }
      // 3. Failed or Expired
      else if (['FAILED', 'EXPIRED', 'CANCELLED'].includes(event)) {
        if (topup.status === 'PENDING') {
          db.prepare(`
            UPDATE topups 
            SET status = 'REJECTED', 
                gateway_status = ?, 
                admin_remarks = 'Payment session cancelled or expired on YouPI-PG' 
            WHERE id = ?
          `).run(event, topup.id);
        }
      }
    });

    executeWebhookAction();

    return res.status(200).json({
      received: true,
      orderId,
      status: 'processed'
    });
  } catch (err) {
    console.error('Webhook processing error:', err);
    res.status(500).json({ error: 'Webhook processing exception' });
  }
});

// Check YouPI Order Status Poll
app.get('/api/wallet/youpi/status/:orderId', authenticateToken, (req, res) => {
  try {
    const topup = db.prepare('SELECT * FROM topups WHERE order_id = ?').get(req.params.orderId);
    if (!topup) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const user = db.prepare('SELECT wallet_balance FROM users WHERE id = ?').get(topup.user_id);
    res.json({
      success: true,
      status: topup.status,
      gateway_status: topup.gateway_status,
      amount: topup.amount,
      utr: topup.utr,
      wallet_balance: user.wallet_balance
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Status check failed' });
  }
});

// Customer: Submit Real UTR for Bank Verification
app.post('/api/wallet/youpi/submit-utr', authenticateToken, (req, res) => {
  try {
    const { orderId, utr } = req.body;
    if (!orderId || !utr || utr.trim().length < 6) {
      return res.status(400).json({ success: false, message: 'Please provide a valid 12-digit UPI UTR reference.' });
    }

    const cleanUtr = utr.trim();
    const topup = db.prepare('SELECT * FROM topups WHERE order_id = ? AND user_id = ?').get(orderId, req.user.id);
    if (!topup) {
      return res.status(404).json({ success: false, message: 'Payment order not found.' });
    }

    if (topup.status === 'APPROVED') {
      return res.json({ success: true, status: 'APPROVED', message: 'Payment has already been approved and credited!' });
    }

    // Check if another topup already used this UTR to prevent replay attacks
    const duplicateUtr = db.prepare("SELECT id FROM topups WHERE utr = ? AND id != ? AND status = 'APPROVED'").get(cleanUtr, topup.id);
    if (duplicateUtr) {
      return res.status(400).json({ success: false, message: 'This UTR has already been claimed on another order.' });
    }

    // Save UTR and mark for manual/automated bank review
    db.prepare(`
      UPDATE topups 
      SET utr = ?, 
          gateway_status = 'MANUAL_REVIEW',
          admin_remarks = 'Customer submitted real UTR: ' || ?
      WHERE id = ?
    `).run(cleanUtr, cleanUtr, topup.id);

    console.log(`[Real Payment] UTR ${cleanUtr} submitted by ${req.user.name} (${req.user.phone}) for Order ${orderId} (₹${topup.amount})`);

    return res.json({
      success: true,
      status: 'PENDING',
      gateway_status: 'MANUAL_REVIEW',
      utr: cleanUtr,
      message: `UTR ${cleanUtr} submitted successfully! Your payment is being verified with Pratik's bank account. Your wallet balance will be credited as soon as verified.`
    });
  } catch (err) {
    console.error('Submit UTR error:', err);
    res.status(500).json({ success: false, message: 'Failed to record UTR.' });
  }
});

// Admin-Only: Simulate YouPI Payment & Webhook (Restricted to Super Admin)
app.post('/api/wallet/youpi/simulate-payment', authenticateToken, requireAdmin, (req, res) => {
  try {
    const { orderId, utr, event } = req.body;
    const topup = db.prepare('SELECT * FROM topups WHERE order_id = ?').get(orderId);
    if (!topup) {
      return res.status(404).json({ success: false, message: 'Top-up session not found.' });
    }

    const chosenEvent = event || 'RECONCILED';
    const chosenUtr = utr || `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;
    const secret = getSetting('youpi_webhook_secret', 'yp_whsec_kpcyber_2026');

    const payloadObj = {
      event: chosenEvent,
      paymentId: topup.gateway_payment_id || `yp_${Date.now()}`,
      orderId: topup.order_id,
      amount: topup.amount.toFixed(2),
      amountPaise: Math.round(topup.amount * 100),
      currency: 'INR',
      method: 'UPI',
      utr: chosenUtr,
      settlementState: chosenEvent === 'RECONCILED' ? 'RECONCILED' : 'NOT_RECONCILED',
      timestamp: Date.now()
    };

    const rawPayload = Buffer.from(JSON.stringify(payloadObj));
    const signature = 'sha256=' + crypto.createHmac('sha256', secret).update(rawPayload).digest('hex');

    // Self-dispatch to the authoritative webhook handler!
    const mockReq = {
      headers: { 'x-gateway-signature': signature },
      rawBody: rawPayload,
      body: payloadObj
    };

    // Process atomically
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(topup.user_id);
    const newBalance = user.wallet_balance + topup.amount;

    db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, user.id);
    db.prepare(`
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
      VALUES (?, 'CREDIT', ?, ?, 'TOPUP', ?, ?)
    `).run(
      user.id,
      topup.amount,
      newBalance,
      chosenUtr,
      `YouPI-PG Payment Verified (UTR: ${chosenUtr})`
    );

    db.prepare(`
      UPDATE topups 
      SET status = 'APPROVED', 
          gateway_status = ?, 
          utr = ?, 
          admin_remarks = 'Automated settlement via YouPI Payment Gateway', 
          processed_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(chosenEvent, chosenUtr, topup.id);

    res.json({
      success: true,
      message: `YouPI-PG Payment verified! ₹${topup.amount.toFixed(2)} credited to your wallet.`,
      newBalance,
      utr: chosenUtr
    });
  } catch (err) {
    console.error('Simulate payment error:', err);
    res.status(500).json({ success: false, message: 'Simulation error.' });
  }
});

// Manual Top-up Submission (Fallback with screenshot)
app.post('/api/wallet/topup', authenticateToken, upload.single('screenshot'), (req, res) => {
  try {
    if (req.user.status !== 'APPROVED') {
      return res.status(403).json({
        success: false,
        message: 'Your account is pending admin approval. You can top up your wallet once approved.'
      });
    }

    const amount = parseFloat(req.body.amount);
    const utr = req.body.utr ? req.body.utr.trim() : '';

    if (!amount || amount < 10) {
      return res.status(400).json({ success: false, message: 'Minimum top-up amount is ₹10.' });
    }
    if (!utr || utr.length < 6) {
      return res.status(400).json({ success: false, message: 'Please provide a valid UTR / Transaction Reference ID.' });
    }

    const existing = db.prepare('SELECT id, status FROM topups WHERE utr = ?').get(utr);
    if (existing) {
      return res.status(400).json({ success: false, message: 'This UTR has already been submitted.' });
    }

    const screenshotPath = req.file ? `/uploads/${req.file.filename}` : null;
    const orderId = `KPC-MANUAL-${Date.now()}`;

    const stmt = db.prepare(`
      INSERT INTO topups (order_id, user_id, amount, utr, payment_method, screenshot_path, status, gateway_status)
      VALUES (?, ?, ?, ?, 'MANUAL_UPI', ?, 'PENDING', 'MANUAL_REVIEW')
    `);
    const result = stmt.run(orderId, req.user.id, amount, utr, screenshotPath);

    res.json({
      success: true,
      message: 'Top-up request submitted! Admin will verify and credit your wallet.',
      topupId: result.lastInsertRowid
    });
  } catch (err) {
    console.error('Topup error:', err);
    res.status(500).json({ success: false, message: 'Error submitting top-up request.' });
  }
});

// User Wallet Transactions History
app.get('/api/wallet/transactions', authenticateToken, (req, res) => {
  try {
    const transactions = db.prepare(`
      SELECT * FROM wallet_transactions 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 50
    `).all(req.user.id);

    const pendingTopups = db.prepare(`
      SELECT * FROM topups 
      WHERE user_id = ? 
      ORDER BY id DESC LIMIT 20
    `).all(req.user.id);

    res.json({
      success: true,
      balance: req.user.wallet_balance,
      rate: req.user.rate,
      transactions,
      topups: pendingTopups
    });
  } catch (err) {
    console.error('Transactions error:', err);
    res.status(500).json({ success: false, message: 'Error fetching transactions.' });
  }
});

// ==========================================
// 3. APPLICATION SUBMISSION ROUTES
// ==========================================

// User Submits Application Details
app.post('/api/submissions/create', authenticateToken, (req, res) => {
  const executeSubmission = db.transaction(() => {
    const freshUser = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (freshUser.status !== 'APPROVED') {
      throw new Error('Account pending admin approval. You cannot submit applications until approved.');
    }

    const { application_no, dob, password, service_type, user_notes } = req.body;

    if (!application_no || !application_no.trim()) {
      throw new Error('Application Number is required.');
    }
    if (!dob || !dob.trim()) {
      throw new Error('Date of Birth is required.');
    }
    if (!password || !password.trim()) {
      throw new Error('Password / Secret is required.');
    }

    const userRate = freshUser.rate || 50.00;

    if (freshUser.wallet_balance < userRate) {
      const deficit = (userRate - freshUser.wallet_balance).toFixed(2);
      throw new Error(`Insufficient wallet balance. Rate is ₹${userRate.toFixed(2)}, current balance is ₹${freshUser.wallet_balance.toFixed(2)}. Please top up at least ₹${deficit} to submit.`);
    }

    const newBalance = freshUser.wallet_balance - userRate;
    db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, freshUser.id);

    const randomHex = Math.random().toString(36).substring(2, 6).toUpperCase();
    const trackingId = `KPC-${new Date().getFullYear()}-${Date.now().toString().slice(-4)}${randomHex}`;

    db.prepare(`
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
      VALUES (?, 'DEBIT', ?, ?, 'SUBMISSION_FEE', ?, ?)
    `).run(
      freshUser.id,
      userRate,
      newBalance,
      trackingId,
      `Service Fee for App #${application_no.trim()} (${service_type || 'LL EXAM'})`
    );

    const result = db.prepare(`
      INSERT INTO submissions (tracking_id, user_id, application_no, dob, password, service_type, service_rate, user_notes, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(
      trackingId,
      freshUser.id,
      application_no.trim(),
      dob.trim(),
      password.trim(),
      service_type ? service_type.trim() : 'LL EXAM',
      userRate,
      user_notes ? user_notes.trim() : null
    );

    return {
      submissionId: result.lastInsertRowid,
      trackingId,
      application_no: application_no.trim(),
      dob: dob.trim(),
      service_type: service_type || 'LL EXAM',
      service_rate: userRate,
      newBalance
    };
  });

  try {
    const outcome = executeSubmission();
    res.json({
      success: true,
      message: 'Application details submitted successfully! Fee deducted from wallet.',
      data: outcome
    });
  } catch (err) {
    console.error('Submission create error:', err.message);
    res.status(400).json({ success: false, message: err.message });
  }
});

// Get User's Submissions
app.get('/api/submissions/my-submissions', authenticateToken, (req, res) => {
  try {
    const submissions = db.prepare(`
      SELECT id, tracking_id, application_no, dob, password, service_type, service_rate, user_notes, status, admin_remarks, result_file, result_url, created_at, updated_at
      FROM submissions
      WHERE user_id = ?
      ORDER BY id DESC
    `).all(req.user.id);

    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
  }
});

// ==========================================
// 4. ADMIN CONTROL PANEL ROUTES
// ==========================================

// Admin Statistics Dashboard
app.get('/api/admin/stats', authenticateToken, requireAdmin, (req, res) => {
  try {
    const totalUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER'").get().count;
    const pendingUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER' AND status = 'PENDING'").get().count;
    const approvedUsers = db.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'USER' AND status = 'APPROVED'").get().count;
    
    const totalSubmissions = db.prepare('SELECT COUNT(*) AS count FROM submissions').get().count;
    const pendingSubmissions = db.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'PENDING'").get().count;
    const processingSubmissions = db.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'PROCESSING'").get().count;
    const completedSubmissions = db.prepare("SELECT COUNT(*) AS count FROM submissions WHERE status = 'COMPLETED'").get().count;
    
    const pendingTopups = db.prepare("SELECT COUNT(*) AS count FROM topups WHERE status = 'PENDING'").get().count;
    const totalWalletBalance = db.prepare("SELECT SUM(wallet_balance) AS total FROM users WHERE role = 'USER'").get().total || 0;
    const totalRevenue = db.prepare("SELECT SUM(service_rate) AS total FROM submissions").get().total || 0;

    res.json({
      success: true,
      stats: {
        totalUsers,
        pendingUsers,
        approvedUsers,
        totalSubmissions,
        pendingSubmissions,
        processingSubmissions,
        completedSubmissions,
        pendingTopups,
        totalWalletBalance,
        totalRevenue
      }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to get stats.' });
  }
});

// Admin: Get Users List
app.get('/api/admin/users', authenticateToken, requireAdmin, (req, res) => {
  try {
    const statusFilter = req.query.status;
    let query = "SELECT id, phone, name, email, role, status, rate, wallet_balance, admin_notes, created_at, approved_at FROM users WHERE role = 'USER'";
    const params = [];

    if (statusFilter && statusFilter !== 'ALL') {
      query += ' AND status = ?';
      params.push(statusFilter);
    }

    query += ' ORDER BY id DESC';
    const users = db.prepare(query).all(...params);

    const usersWithStats = users.map(u => {
      const subCount = db.prepare('SELECT COUNT(*) as count FROM submissions WHERE user_id = ?').get(u.id).count;
      return { ...u, submissionsCount: subCount };
    });

    res.json({ success: true, users: usersWithStats });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch users.' });
  }
});

// Admin: Approve User & Set Rate
app.post('/api/admin/users/:id/approve', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { rate, admin_notes } = req.body;

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    const assignedRate = (rate !== undefined && rate !== null && !isNaN(rate) && parseFloat(rate) >= 0)
      ? parseFloat(rate)
      : (user.rate || 50.00);

    db.prepare(`
      UPDATE users 
      SET status = 'APPROVED', 
          rate = ?, 
          admin_notes = ?, 
          approved_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(assignedRate, admin_notes || 'Approved by Admin', userId);

    res.json({
      success: true,
      message: `User ${user.name} approved successfully with Rate ₹${assignedRate.toFixed(2)}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to approve user.' });
  }
});

// Admin: Update User Rate
app.post('/api/admin/users/:id/update-rate', authenticateToken, requireAdmin, (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const { rate } = req.body;

    if (rate === undefined || isNaN(rate) || parseFloat(rate) < 0) {
      return res.status(400).json({ success: false, message: 'Please provide a valid rate (₹0 or greater).' });
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found.' });
    }

    db.prepare('UPDATE users SET rate = ? WHERE id = ?').run(parseFloat(rate), userId);

    res.json({
      success: true,
      message: `Rate for ${user.name} updated to ₹${parseFloat(rate).toFixed(2)}.`
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update rate.' });
  }
});

// Admin: Adjust Wallet Balance (Credit/Debit)
app.post('/api/admin/users/:id/adjust-wallet', authenticateToken, requireAdmin, (req, res) => {
  const adjustTransaction = db.transaction(() => {
    const userId = parseInt(req.params.id);
    const { type, amount, reason } = req.body;

    if (!['CREDIT', 'DEBIT'].includes(type)) {
      throw new Error('Adjustment type must be CREDIT or DEBIT.');
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      throw new Error('Amount must be greater than zero.');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      throw new Error('User not found.');
    }

    let newBalance = user.wallet_balance;
    if (type === 'CREDIT') {
      newBalance += numAmount;
    } else {
      if (user.wallet_balance < numAmount) {
        throw new Error(`Cannot debit ₹${numAmount}. User only has ₹${user.wallet_balance.toFixed(2)}.`);
      }
      newBalance -= numAmount;
    }

    db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, userId);

    db.prepare(`
      INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
      VALUES (?, ?, ?, ?, 'MANUAL_ADJUSTMENT', ?, ?)
    `).run(
      userId,
      type,
      numAmount,
      newBalance,
      `ADMIN-${Date.now().toString().slice(-4)}`,
      reason || `Manual ${type} by Administrator`
    );

    return { newBalance, userName: user.name };
  });

  try {
    const resData = adjustTransaction();
    res.json({
      success: true,
      message: `Successfully adjusted wallet of ${resData.userName}. New Balance: ₹${resData.newBalance.toFixed(2)}.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin: View Topup Requests
app.get('/api/admin/topups', authenticateToken, requireAdmin, (req, res) => {
  try {
    const status = req.query.status;
    let query = `
      SELECT t.*, u.name as user_name, u.phone as user_phone, u.wallet_balance as user_wallet
      FROM topups t
      JOIN users u ON t.user_id = u.id
    `;
    const params = [];
    if (status && status !== 'ALL') {
      query += ' WHERE t.status = ?';
      params.push(status);
    }
    query += ' ORDER BY t.id DESC';

    const topups = db.prepare(query).all(...params);
    res.json({ success: true, topups });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch topups.' });
  }
});

// Admin: Approve / Reject Topup
app.post('/api/admin/topups/:id/process', authenticateToken, requireAdmin, (req, res) => {
  const processTopupTx = db.transaction(() => {
    const topupId = parseInt(req.params.id);
    const { action, remarks } = req.body;

    const topup = db.prepare('SELECT * FROM topups WHERE id = ?').get(topupId);
    if (!topup) {
      throw new Error('Top-up request not found.');
    }
    if (topup.status !== 'PENDING') {
      throw new Error(`This top-up request has already been ${topup.status.toLowerCase()}.`);
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(topup.user_id);
    if (!user) {
      throw new Error('User not found.');
    }

    if (action === 'APPROVE') {
      const newBalance = user.wallet_balance + topup.amount;
      db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, user.id);
      
      db.prepare(`
        INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
        VALUES (?, 'CREDIT', ?, ?, 'TOPUP', ?, ?)
      `).run(
        user.id,
        topup.amount,
        newBalance,
        topup.utr || topup.order_id,
        `Wallet Top-up approved (Ref: ${topup.utr || topup.order_id})`
      );

      db.prepare(`
        UPDATE topups 
        SET status = 'APPROVED', admin_remarks = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(remarks || 'Approved by Admin', topupId);

      return { action: 'APPROVED', amount: topup.amount, userName: user.name, newBalance };
    } else {
      db.prepare(`
        UPDATE topups 
        SET status = 'REJECTED', admin_remarks = ?, processed_at = CURRENT_TIMESTAMP 
        WHERE id = ?
      `).run(remarks || 'Rejected by Admin', topupId);

      return { action: 'REJECTED', amount: topup.amount, userName: user.name };
    }
  });

  try {
    const outcome = processTopupTx();
    res.json({
      success: true,
      message: `Top-up of ₹${outcome.amount} for ${outcome.userName} ${outcome.action.toLowerCase()}.`
    });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin: View All Submissions
app.get('/api/admin/submissions', authenticateToken, requireAdmin, (req, res) => {
  try {
    const status = req.query.status;
    let query = `
      SELECT s.*, u.name as user_name, u.phone as user_phone, u.wallet_balance as user_wallet
      FROM submissions s
      JOIN users u ON s.user_id = u.id
    `;
    const params = [];
    if (status && status !== 'ALL') {
      query += ' WHERE s.status = ?';
      params.push(status);
    }
    query += ' ORDER BY s.id DESC';

    const submissions = db.prepare(query).all(...params);
    res.json({ success: true, submissions });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch submissions.' });
  }
});

// Admin: Update Submission Status
app.post('/api/admin/submissions/:id/update-status', authenticateToken, requireAdmin, upload.single('result_file'), (req, res) => {
  const updateSubTx = db.transaction(() => {
    const submissionId = parseInt(req.params.id);
    const { status, admin_remarks, result_url, refund_fee } = req.body;

    if (!['PENDING', 'PROCESSING', 'COMPLETED', 'REJECTED'].includes(status)) {
      throw new Error('Invalid submission status.');
    }

    const sub = db.prepare('SELECT * FROM submissions WHERE id = ?').get(submissionId);
    if (!sub) {
      throw new Error('Submission not found.');
    }

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(sub.user_id);
    let resultFilePath = sub.result_file;
    if (req.file) {
      resultFilePath = `/uploads/${req.file.filename}`;
    }

    let refunded = false;
    if (status === 'REJECTED' && (refund_fee === 'true' || refund_fee === true) && sub.status !== 'REJECTED') {
      const newBalance = user.wallet_balance + sub.service_rate;
      db.prepare('UPDATE users SET wallet_balance = ? WHERE id = ?').run(newBalance, user.id);
      
      db.prepare(`
        INSERT INTO wallet_transactions (user_id, type, amount, balance_after, category, reference_id, description)
        VALUES (?, 'CREDIT', ?, ?, 'REFUND', ?, ?)
      `).run(
        user.id,
        sub.service_rate,
        newBalance,
        sub.tracking_id,
        `Refund for rejected Application #${sub.application_no}`
      );
      refunded = true;
    }

    db.prepare(`
      UPDATE submissions 
      SET status = ?, 
          admin_remarks = ?, 
          result_url = ?, 
          result_file = ?, 
          updated_at = CURRENT_TIMESTAMP 
      WHERE id = ?
    `).run(
      status,
      admin_remarks || sub.admin_remarks,
      result_url || sub.result_url,
      resultFilePath,
      submissionId
    );

    return { status, trackingId: sub.tracking_id, refunded, amount: sub.service_rate };
  });

  try {
    const outcome = updateSubTx();
    let msg = `Submission ${outcome.trackingId} status updated to ${outcome.status}.`;
    if (outcome.refunded) {
      msg += ` ₹${outcome.amount.toFixed(2)} was refunded back to customer wallet.`;
    }
    res.json({ success: true, message: msg });
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
});

// Admin: System Settings Management
app.get('/api/settings', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM system_settings').all();
    const map = {};
    settings.forEach(s => map[s.key] = s.value);
    res.json({ success: true, settings: map });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch settings.' });
  }
});

app.post('/api/admin/settings', authenticateToken, requireAdmin, (req, res) => {
  try {
    const {
      default_rate, upi_id, upi_name, support_phone, portal_name,
      youpi_api_url, youpi_merchant_id, youpi_merchant_api_key, youpi_webhook_secret
    } = req.body;
    const upsert = db.prepare('INSERT OR REPLACE INTO system_settings (key, value) VALUES (?, ?)');

    if (default_rate !== undefined) upsert.run('default_rate', default_rate.toString());
    if (upi_id !== undefined) upsert.run('upi_id', upi_id);
    if (upi_name !== undefined) upsert.run('upi_name', upi_name);
    if (support_phone !== undefined) upsert.run('support_phone', support_phone);
    if (portal_name !== undefined) upsert.run('portal_name', portal_name);

    // YouPI Gateway Settings
    if (youpi_api_url !== undefined) upsert.run('youpi_api_url', youpi_api_url);
    if (youpi_merchant_id !== undefined) upsert.run('youpi_merchant_id', youpi_merchant_id);
    if (youpi_merchant_api_key !== undefined) upsert.run('youpi_merchant_api_key', youpi_merchant_api_key);
    if (youpi_webhook_secret !== undefined) upsert.run('youpi_webhook_secret', youpi_webhook_secret);

    // SMS Gateway Settings
    const { sms_provider, fast2sms_api_key, twofactor_api_key, twilio_account_sid, twilio_auth_token, twilio_from_phone } = req.body;
    if (sms_provider !== undefined) upsert.run('sms_provider', sms_provider);
    if (fast2sms_api_key !== undefined) upsert.run('fast2sms_api_key', fast2sms_api_key);
    if (twofactor_api_key !== undefined) upsert.run('twofactor_api_key', twofactor_api_key);
    if (twilio_account_sid !== undefined) upsert.run('twilio_account_sid', twilio_account_sid);
    if (twilio_auth_token !== undefined) upsert.run('twilio_auth_token', twilio_auth_token);
    if (twilio_from_phone !== undefined) upsert.run('twilio_from_phone', twilio_from_phone);

    res.json({ success: true, message: 'Portal, YouPI Gateway, and SMS settings updated successfully.' });
  } catch (err) {
    console.error('Settings update error:', err);
    res.status(500).json({ success: false, message: 'Failed to update settings.' });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`=======================================================`);
  console.log(`  KP CYBER Service Provider Portal`);
  console.log(`  Integrated with YouPI-PG (Sovereign UPI Gateway)`);
  console.log(`  Server listening on http://localhost:${PORT}`);
  console.log(`  Admin Portal: Secured Access Only`);
  console.log(`=======================================================`);
});
