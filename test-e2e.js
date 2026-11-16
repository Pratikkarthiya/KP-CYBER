// End-to-End Automated Verification for KP Cyber Portal
async function runTests() {
  const baseUrl = 'http://localhost:3000';
  console.log('🚀 Starting E2E Flow Test on', baseUrl);

  // 1. Send OTP for customer
  const phone = '9876500001';
  console.log('\n--- 1. Testing Mobile OTP Generation ---');
  let res = await fetch(`${baseUrl}/api/auth/send-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, name: 'Suresh Kumar' })
  });
  let data = await res.json();
  console.log('Send OTP response:', data);
  if (!data.success || !data.debugOtp) throw new Error('Send OTP failed');
  const otp = data.debugOtp;

  // 2. Verify OTP & Register
  console.log('\n--- 2. Testing OTP Verification & Login ---');
  res = await fetch(`${baseUrl}/api/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, otp, name: 'Suresh Kumar' })
  });
  data = await res.json();
  console.log('Verify OTP response:', data);
  if (!data.success || !data.token) throw new Error('Verify OTP failed');
  const userToken = data.token;
  const userId = data.user.id;
  console.log(`User created: ID=${userId}, Status=${data.user.status}, Balance=₹${data.user.wallet_balance}`);
  if (data.user.status !== 'PENDING') throw new Error('Initial status should be PENDING');

  // 3. User tries to submit while PENDING -> should be rejected
  console.log('\n--- 3. Testing Submission Gate (Must fail when PENDING) ---');
  res = await fetch(`${baseUrl}/api/submissions/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      application_no: 'APP-1001',
      dob: '2000-01-01',
      password: 'MyPassword123'
    })
  });
  data = await res.json();
  console.log('Submission under PENDING status:', data);
  if (data.success) throw new Error('Submission should fail when user is pending approval');
  console.log('✓ Correctly blocked: User cannot submit before Admin approval.');

  // 4. Admin Login
  console.log('\n--- 4. Testing Admin Login ---');
  res = await fetch(`${baseUrl}/api/auth/admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: 'pratikarthiya6', password: 'pratik3361' })
  });
  data = await res.json();
  console.log('Admin login response:', data);
  if (!data.success || !data.token) throw new Error('Admin login failed');
  const adminToken = data.token;

  // 5. Admin Approves User & Assigns Custom Rate (e.g. ₹45.00)
  console.log('\n--- 5. Admin Approves User & Sets Rate = ₹45.00 ---');
  res = await fetch(`${baseUrl}/api/admin/users/${userId}/approve`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ rate: 45.00, admin_notes: 'Approved verified local customer' })
  });
  data = await res.json();
  console.log('Admin approve response:', data);
  if (!data.success) throw new Error('Admin approve failed');

  // 6. User verifies profile is now APPROVED and Rate is ₹45.00
  console.log('\n--- 6. Verify User Profile Updated ---');
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  console.log('User profile:', data.user);
  if (data.user.status !== 'APPROVED' || data.user.rate !== 45) {
    throw new Error('User status or rate mismatch');
  }
  console.log(`✓ User status: ${data.user.status}, Assigned Rate: ₹${data.user.rate}`);

  // 7. User tries to submit with ₹0 balance -> should fail
  console.log('\n--- 7. Submission with Insufficient Wallet Balance (Must fail) ---');
  res = await fetch(`${baseUrl}/api/submissions/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      application_no: 'APP-1001',
      dob: '2000-01-01',
      password: 'MyPassword123'
    })
  });
  data = await res.json();
  console.log('Submission with 0 balance:', data);
  if (data.success) throw new Error('Should fail due to insufficient balance');
  console.log('✓ Correctly blocked: Wallet top-up required before submission.');

  // 8. User requests Wallet Top-Up of ₹200
  console.log('\n--- 8. User submits Top-Up Request for ₹200.00 ---');
  res = await fetch(`${baseUrl}/api/wallet/topup`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({ amount: 200, utr: 'UTR998877665544' })
  });
  data = await res.json();
  console.log('Topup request response:', data);
  if (!data.success) throw new Error('Topup request failed');
  const topupId = data.topupId;

  // 9. Admin Approves Top-Up Request
  console.log('\n--- 9. Admin Approves Top-Up Request ---');
  res = await fetch(`${baseUrl}/api/admin/topups/${topupId}/process`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({ action: 'APPROVE', remarks: 'Payment received via GPay' })
  });
  data = await res.json();
  console.log('Admin topup approve:', data);
  if (!data.success) throw new Error('Admin topup approval failed');

  // Check user balance after top-up
  res = await fetch(`${baseUrl}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  console.log(`✓ User wallet balance after topup: ₹${data.user.wallet_balance}`);
  if (data.user.wallet_balance !== 200) throw new Error('Balance should be 200');

  // 10. User submits Application Details (Application No, DOB, Password)
  console.log('\n--- 10. User Submits Application Details ---');
  res = await fetch(`${baseUrl}/api/submissions/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${userToken}`
    },
    body: JSON.stringify({
      application_no: 'SSC-CGL-2026-98124',
      dob: '2001-08-25',
      password: 'CandidatePass@2026',
      service_type: 'Admit Card Download',
      user_notes: 'Please download tier-1 hall ticket'
    })
  });
  data = await res.json();
  console.log('Application submission response:', data);
  if (!data.success) throw new Error('Application submission failed');
  const submissionId = data.data.submissionId;
  const trackingId = data.data.trackingId;
  console.log(`✓ Application created: Tracking ID=${trackingId}, New Balance=₹${data.data.newBalance}`);
  if (data.data.newBalance !== 155) throw new Error('Balance should be ₹155 (200 - 45)');

  // 11. Admin views Submissions
  console.log('\n--- 11. Admin views Application Submissions ---');
  res = await fetch(`${baseUrl}/api/admin/submissions?status=ALL`, {
    headers: { 'Authorization': `Bearer ${adminToken}` }
  });
  data = await res.json();
  console.log(`Admin sees ${data.submissions.length} submissions.`);
  const foundSub = data.submissions.find(s => s.id === submissionId);
  if (!foundSub) throw new Error('Submitted application not found by admin');
  console.log('Admin verified details:', {
    application_no: foundSub.application_no,
    dob: foundSub.dob,
    password: foundSub.password,
    service_rate: foundSub.service_rate,
    status: foundSub.status
  });

  // 12. Admin Updates Submission Status to COMPLETED
  console.log('\n--- 12. Admin Marks Submission as COMPLETED ---');
  res = await fetch(`${baseUrl}/api/admin/submissions/${submissionId}/update-status`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${adminToken}`
    },
    body: JSON.stringify({
      status: 'COMPLETED',
      admin_remarks: 'Admit card downloaded. Exam Center: Patna Zone 2.',
      result_url: 'https://example.com/admit-card.pdf'
    })
  });
  data = await res.json();
  console.log('Admin update status response:', data);
  if (!data.success) throw new Error('Update submission status failed');

  // 13. User views completed application
  console.log('\n--- 13. User Checks Submitted Applications ---');
  res = await fetch(`${baseUrl}/api/submissions/my-submissions`, {
    headers: { 'Authorization': `Bearer ${userToken}` }
  });
  data = await res.json();
  const userSub = data.submissions.find(s => s.id === submissionId);
  console.log('User sees completed submission:', {
    tracking_id: userSub.tracking_id,
    status: userSub.status,
    admin_remarks: userSub.admin_remarks,
    result_url: userSub.result_url
  });
  if (userSub.status !== 'COMPLETED') throw new Error('Status should be COMPLETED');

  console.log('\n🎉 ALL 13 TEST CASES PASSED SUCCESSFULLY!');
  console.log('The entire workflow requested by user is working flawlessly.');
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});
