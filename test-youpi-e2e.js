// Test YouPI-PG Payment Gateway Integration
const crypto = require('crypto');

async function testYouPiIntegration() {
  const baseUrl = 'http://localhost:3000';
  console.log('🧪 Starting YouPI-PG Integration Test...');

  // 1. Send OTP & Login User
  const phone = '9876500002';
  let res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: 'Amit Verma' })
  });
  let data = await res.json();
  const otp = data.debugOtp;

  res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, name: 'Amit Verma' })
  });
  data = await res.json();
  const userToken = data.token;
  const userId = data.user.id;
  const initialBalance = parseFloat(data.user.wallet_balance || 0);
  console.log(`✓ User Amit logged in. ID=${userId}, Status=${data.user.status}, Initial Balance=₹${initialBalance}`);

  // 2. Admin Login & Approve Amit with Rate ₹60.00
  res = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: '9876543210', password: 'admin123' })
  });
  data = await res.json();
  const adminToken = data.token;

  res = await fetch(`${baseUrl}/api/admin/users/${userId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ rate: 60.00, admin_notes: 'Approved via YouPI test' })
  });
  data = await res.json();
  console.log('✓ Admin approved user with Rate ₹60.00');

  // 3. Initiate YouPI-PG Payment Session for ₹150.00
  console.log('\n--- Initiating YouPI-PG Session for ₹150.00 ---');
  res = await fetch(`${baseUrl}/api/wallet/youpi/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ amount: 150 })
  });
  data = await res.json();
  console.log('YouPI create session response:', data);
  if (!data.success || !data.orderId) throw new Error('YouPI session creation failed');
  const orderId = data.orderId;
  const paymentId = data.paymentId;

  // 4. Test Official Signed YouPI Webhook
  console.log('\n--- Testing Official HMAC-SHA256 Signed YouPI Webhook ---');
  const webhookSecret = 'yp_whsec_kpcyber_2026';
  const utr = `UTR${Math.floor(100000000000 + Math.random() * 900000000000)}`;

  const webhookPayload = JSON.stringify({
    event: 'RECONCILED',
    paymentId: paymentId,
    orderId: orderId,
    amount: '150.00',
    amountPaise: 15000,
    currency: 'INR',
    method: 'UPI',
    utr: utr,
    settlementState: 'RECONCILED',
    timestamp: Date.now()
  });

  const rawBytes = Buffer.from(webhookPayload);
  const signature = 'sha256=' + crypto.createHmac('sha256', webhookSecret).update(rawBytes).digest('hex');

  res = await fetch(`${baseUrl}/api/webhooks/youpi`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-gateway-signature': signature,
      'x-gateway-event': 'RECONCILED',
      'x-gateway-delivery-id': 'deliv-test-001',
      'x-gateway-timestamp': Date.now().toString()
    },
    body: rawBytes
  });
  data = await res.json();
  console.log('YouPI webhook response:', data);
  if (!data.received) throw new Error('Webhook processing failed');
  console.log('✓ YouPI HMAC-SHA256 signature verified and accepted by KP Cyber portal!');

  // 5. Verify User Wallet Balance
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  console.log(`✓ User wallet balance after YouPI reconciliation: ₹${data.user.wallet_balance}`);
  if (parseFloat(data.user.wallet_balance) !== (initialBalance + 150)) {
    throw new Error(`Wallet balance should be ${initialBalance + 150}, got ${data.user.wallet_balance}`);
  }

  // 6. User submits application (Rate ₹60 debited from ₹150 balance)
  console.log('\n--- Submitting Candidate Details ---');
  res = await fetch(`${baseUrl}/api/submissions/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      application_no: 'JEE-MAIN-2026-5544',
      dob: '2002-11-20',
      password: 'JeeCandidate#2026',
      service_type: 'Admit Card Download'
    })
  });
  data = await res.json();
  console.log('Submission result:', data);
  if (!data.success) throw new Error('Submission failed');
  console.log(`✓ Fee deducted: ₹${data.data.service_rate}, Remaining Balance: ₹${data.data.newBalance}`);
  if (parseFloat(data.data.newBalance) !== (initialBalance + 150 - 60)) {
    throw new Error(`Expected ${initialBalance + 150 - 60} balance, got ${data.data.newBalance}`);
  }

  console.log('\n🎉 ALL YouPI-PG GATEWAY TESTS PASSED SUCCESSFULLY!');
}

testYouPiIntegration().catch(e => {
  console.error('❌ YouPI Test Failed:', e);
  process.exit(1);
});
