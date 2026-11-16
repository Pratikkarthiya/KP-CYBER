const assert = require('assert');

async function testRealPaymentFlow() {
  const baseUrl = 'http://localhost:3000';
  console.log('🧪 Starting Real / Non-Simulated Payment Test...');

  // 1. User Amit Logs In via Mobile OTP
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
  const initialBalance = parseFloat(data.user.wallet_balance || 0);
  console.log(`✓ User logged in. Balance: ₹${initialBalance}`);

  // 2. User Creates Real Payment Session for ₹100
  res = await fetch(`${baseUrl}/api/wallet/youpi/create-session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ amount: 100 })
  });
  data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.upiId, 'pratikkarthiya6@oksbi');
  assert.strictEqual(data.upiName, 'Pratik Karthiya');
  assert(data.upiUri.includes('pratikkarthiya6%40oksbi'));
  console.log(`✓ Real UPI Session created. Order: ${data.orderId}`);
  console.log(`  UPI ID: ${data.upiId} (${data.upiName})`);
  console.log(`  NPCI URI: ${data.upiUri}`);
  const orderId = data.orderId;

  // 3. User Submits Real 12-Digit UTR
  const realUtr = '4321' + Math.floor(10000000 + Math.random() * 90000000);
  res = await fetch(`${baseUrl}/api/wallet/youpi/submit-utr`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ orderId, utr: realUtr })
  });
  data = await res.json();
  assert.strictEqual(data.success, true);
  assert.strictEqual(data.status, 'PENDING');
  assert.strictEqual(data.gateway_status, 'MANUAL_REVIEW');
  console.log(`✓ Real UTR ${realUtr} recorded for verification.`);

  // Verify wallet is NOT fraudulently credited before bank verification
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  assert.strictEqual(parseFloat(data.user.wallet_balance), initialBalance);
  console.log('✓ Verified: Wallet balance is securely locked until bank verification.');

  // 4. Verify Non-Admin CANNOT call simulate-payment
  res = await fetch(`${baseUrl}/api/wallet/youpi/simulate-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ orderId, utr: realUtr })
  });
  assert.strictEqual(res.status, 403);
  console.log('✓ Verified: Normal users are strictly forbidden from simulation endpoint (HTTP 403).');

  // 5. Admin Logs In and Approves the Real Topup
  res = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'pratikarthiya6', password: 'pratik3361' })
  });
  data = await res.json();
  const adminToken = data.token;

  // Fetch pending topup ID
  res = await fetch(`${baseUrl}/api/admin/topups?status=PENDING`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  data = await res.json();
  const topupRecord = data.topups.find(t => t.order_id === orderId);
  assert(topupRecord, 'Topup record must appear in Admin PENDING queue');
  assert.strictEqual(topupRecord.utr, realUtr);
  console.log(`✓ Admin sees pending request: ID=${topupRecord.id}, UTR=${topupRecord.utr}, Amount=₹${topupRecord.amount}`);

  // Admin approves topup
  res = await fetch(`${baseUrl}/api/admin/topups/${topupRecord.id}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ action: 'APPROVE', remarks: 'Verified against SBI bank statement' })
  });
  data = await res.json();
  assert.strictEqual(data.success, true);
  console.log('✓ Admin successfully approved and credited the topup!');

  // 6. User Balance Verification
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  const finalBalance = parseFloat(data.user.wallet_balance);
  assert.strictEqual(finalBalance, initialBalance + 100);
  console.log(`✓ Final verified wallet balance: ₹${finalBalance} (Correctly credited ₹100.00)`);

  console.log('\n🎉 ALL REAL PAYMENT & VERIFICATION TESTS PASSED 100%!');
}

testRealPaymentFlow().catch(e => {
  console.error('❌ Test failed:', e);
  process.exit(1);
});
