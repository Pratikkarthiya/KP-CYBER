// KP CYBER Client Application Logic

const STATE = {
  token: localStorage.getItem('kp_token') || null,
  user: null,
  settings: {},
  activeUserTab: 'submit',
  activeAdminTab: 'users',
  selectedTopupAmount: 100,
};

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  lucide.createIcons();
  await loadPublicSettings();
  if (STATE.token) {
    await fetchCurrentUser();
  } else {
    showLandingView();
  }
});

// Toast Notifications
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `px-4 py-3 rounded-2xl shadow-2xl text-xs font-semibold flex items-center space-x-2 transition-all transform duration-300 pointer-events-auto border ${
    type === 'success' ? 'bg-emerald-950/90 border-emerald-500/40 text-emerald-300' :
    type === 'error' ? 'bg-rose-950/90 border-rose-500/40 text-rose-300' :
    type === 'warning' ? 'bg-amber-950/90 border-amber-500/40 text-amber-300' :
    'bg-slate-900/90 border-slate-700 text-slate-200'
  }`;

  const iconName = type === 'success' ? 'check-circle' : type === 'error' ? 'alert-octagon' : type === 'warning' ? 'alert-triangle' : 'info';
  toast.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0"></i><span>${message}</span>`;
  container.appendChild(toast);
  lucide.createIcons();

  setTimeout(() => {
    toast.classList.add('opacity-0', 'translate-x-4');
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

// Copy to Clipboard
function copyToClipboard(text, label = 'Copied') {
  navigator.clipboard.writeText(text).then(() => {
    showToast(`${label} copied to clipboard!`, 'success');
  }).catch(() => {
    showToast('Failed to copy', 'error');
  });
}

// Fetch Public Settings
async function loadPublicSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success) {
      STATE.settings = data.settings;
      if (data.settings.upi_id) {
        const el = document.getElementById('topup-display-upi-id');
        if (el) el.innerText = data.settings.upi_id;
      }
    }
  } catch (err) {
    console.error('Settings fetch error:', err);
  }
}

// Modal Handlers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) {
    el.classList.remove('hidden');
    lucide.createIcons();
  }
}

function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// View Switchers
function showLandingView() {
  document.getElementById('view-landing').classList.remove('hidden');
  document.getElementById('view-user').classList.add('hidden');
  document.getElementById('view-admin').classList.add('hidden');
  document.getElementById('nav-unauth').classList.remove('hidden');
  document.getElementById('nav-auth').classList.add('hidden');
  lucide.createIcons();
}

function showUserView() {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-user').classList.remove('hidden');
  document.getElementById('view-admin').classList.add('hidden');
  document.getElementById('nav-unauth').classList.add('hidden');
  document.getElementById('nav-auth').classList.remove('hidden');
  updateNavbarState();
  updateUserDashboard();
  switchUserTab(STATE.activeUserTab);
  lucide.createIcons();
}

function showAdminView() {
  document.getElementById('view-landing').classList.add('hidden');
  document.getElementById('view-user').classList.add('hidden');
  document.getElementById('view-admin').classList.remove('hidden');
  document.getElementById('nav-unauth').classList.add('hidden');
  document.getElementById('nav-auth').classList.remove('hidden');
  updateNavbarState();
  loadAdminStats();
  switchAdminTab(STATE.activeAdminTab);
  lucide.createIcons();
}

// Navbar updates
function updateNavbarState() {
  if (!STATE.user) return;
  document.getElementById('nav-user-name').innerText = STATE.user.name || 'User';
  document.getElementById('nav-wallet-balance').innerText = `₹${(STATE.user.wallet_balance || 0).toFixed(2)}`;

  const statusBadge = document.getElementById('nav-user-status');
  if (STATE.user.role === 'ADMIN') {
    statusBadge.innerText = 'Admin';
    statusBadge.className = 'text-[10px] font-bold text-purple-400';
    document.getElementById('nav-rate-badge').classList.add('hidden');
  } else {
    statusBadge.innerText = STATE.user.status === 'APPROVED' ? 'Verified & Approved' : 'Pending Approval';
    statusBadge.className = STATE.user.status === 'APPROVED' ? 'text-[10px] font-bold text-emerald-400' : 'text-[10px] font-bold text-amber-400';
    
    // User Rate
    const rateEl = document.getElementById('nav-user-rate');
    if (rateEl) rateEl.innerText = `₹${(STATE.user.rate || 50).toFixed(2)}`;
    document.getElementById('nav-rate-badge').classList.remove('hidden');
  }
}

// ==============================================================
// AUTHENTICATION LOGIC
// ==============================================================

function openAuthModal(tab = 'user') {
  openModal('modal-auth');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  const btnUser = document.getElementById('auth-tab-btn-user');
  const btnAdmin = document.getElementById('auth-tab-btn-admin');
  const tabUser = document.getElementById('auth-tab-user');
  const tabAdmin = document.getElementById('auth-tab-admin');

  if (tab === 'user') {
    btnUser.className = 'pb-2.5 text-indigo-400 border-b-2 border-indigo-500 font-bold text-sm flex items-center space-x-1.5';
    btnAdmin.className = 'pb-2.5 text-slate-400 hover:text-slate-200 font-bold text-sm flex items-center space-x-1.5';
    tabUser.classList.remove('hidden');
    tabAdmin.classList.add('hidden');
  } else {
    btnAdmin.className = 'pb-2.5 text-purple-400 border-b-2 border-purple-500 font-bold text-sm flex items-center space-x-1.5';
    btnUser.className = 'pb-2.5 text-slate-400 hover:text-slate-200 font-bold text-sm flex items-center space-x-1.5';
    tabAdmin.classList.remove('hidden');
    tabUser.classList.add('hidden');
  }
  lucide.createIcons();
}

function fillDemoAdmin() {
  // Demo autofill disabled for security
}

function resetOTPForm() {
  if (document.getElementById('auth-step-phone')) {
    document.getElementById('auth-step-phone').classList.remove('hidden');
    document.getElementById('auth-step-otp').classList.add('hidden');
    document.getElementById('auth-otp-input').value = '';
  }
}

// Direct User Login (No OTP required)
async function handleUserLogin() {
  const phoneInput = document.getElementById('auth-user-phone');
  const nameInput = document.getElementById('auth-user-name');
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const name = nameInput ? nameInput.value.trim() : '';
  const btn = document.getElementById('btn-user-login') || document.getElementById('btn-send-otp');

  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', 'warning');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = 'Logging in...';
  }

  try {
    let res = await fetch('/api/auth/direct-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name })
    });

    let data;
    if (res.status === 404) {
      // Automatic fallback: silently auto-login via background OTP exchange
      const sendRes = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, name })
      });
      const sendData = await sendRes.json();

      if (sendData.success && sendData.otp) {
        res = await fetch('/api/auth/verify-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ phone, otp: sendData.otp, name })
        });
        data = await res.json();
      } else {
        data = sendData;
      }
    } else {
      data = await res.json();
    }

    if (data && data.success) {
      STATE.token = data.token;
      STATE.user = data.user;
      localStorage.setItem('kp_token', data.token);

      closeModal('modal-auth');
      showToast(data.message || 'Logged in successfully!', 'success');

      if (data.user.role === 'ADMIN') {
        showAdminView();
      } else {
        showUserView();
      }
    } else {
      showToast((data && data.message) || 'Login failed', 'error');
    }
  } catch (err) {
    console.error('Login error details:', err);
    showToast(err.message ? ('Error: ' + err.message) : 'Network error during login', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="log-in" class="w-4 h-4"></i><span>Login to Account</span>`;
      lucide.createIcons();
    }
  }
}

// Send OTP
async function handleSendOTP() {
  const phone = document.getElementById('auth-user-phone').value.trim();
  const name = document.getElementById('auth-user-name').value.trim();
  const btn = document.getElementById('btn-send-otp');

  if (!phone || phone.length < 10) {
    showToast('Please enter a valid 10-digit mobile number', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Sending OTP...';

  try {
    const res = await fetch('/api/auth/send-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, name })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('auth-display-phone').innerText = `+91 ${data.phone}`;
      
      // If debug OTP provided, show banner; otherwise hide for real SMS mode
      const debugBanner = document.getElementById('auth-otp-debug-banner');
      if (data.debugOtp) {
        document.getElementById('auth-debug-otp-code').innerText = data.debugOtp;
        debugBanner.dataset.code = data.debugOtp;
        debugBanner.classList.remove('hidden');
      } else {
        debugBanner.classList.add('hidden');
      }

      document.getElementById('auth-step-phone').classList.add('hidden');
      document.getElementById('auth-step-otp').classList.remove('hidden');
      document.getElementById('auth-otp-input').focus();
    } else {
      showToast(data.message || 'Error sending OTP', 'error');
    }
  } catch (err) {
    showToast('Network error while requesting OTP', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="send" class="w-4 h-4"></i><span>Get OTP on Mobile</span>`;
    lucide.createIcons();
  }
}

function autoFillOTP() {
  const code = document.getElementById('auth-otp-debug-banner').dataset.code;
  if (code) {
    document.getElementById('auth-otp-input').value = code;
    showToast('OTP auto-filled!', 'info');
  }
}

// Verify OTP
async function handleVerifyOTP() {
  const phone = document.getElementById('auth-user-phone').value.trim();
  const otp = document.getElementById('auth-otp-input').value.trim();
  const name = document.getElementById('auth-user-name').value.trim();
  const btn = document.getElementById('btn-verify-otp');

  if (!otp || otp.length < 4) {
    showToast('Please enter the 6-digit OTP', 'warning');
    return;
  }

  btn.disabled = true;
  btn.innerHTML = 'Verifying...';

  try {
    const res = await fetch('/api/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, otp, name })
    });
    const data = await res.json();

    if (data.success) {
      STATE.token = data.token;
      STATE.user = data.user;
      localStorage.setItem('kp_token', data.token);

      closeModal('modal-auth');
      showToast(data.message, 'success');

      if (data.user.role === 'ADMIN') {
        showAdminView();
      } else {
        showUserView();
      }
    } else {
      showToast(data.message || 'OTP verification failed', 'error');
    }
  } catch (err) {
    showToast('Network error during verification', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check" class="w-4 h-4"></i><span>Verify & Access Account</span>`;
    lucide.createIcons();
  }
}

// Admin Login
async function handleAdminLogin() {
  const login = document.getElementById('auth-admin-login').value.trim();
  const password = document.getElementById('auth-admin-password').value.trim();

  if (!login || !password) {
    showToast('Please enter admin login and password', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ login, password })
    });
    const data = await res.json();

    if (data.success) {
      STATE.token = data.token;
      STATE.user = data.user;
      localStorage.setItem('kp_token', data.token);

      closeModal('modal-auth');
      showToast('Admin logged in successfully', 'success');
      showAdminView();
    } else {
      showToast(data.message || 'Admin login failed', 'error');
    }
  } catch (err) {
    showToast('Network error during admin login', 'error');
  }
}

// Fetch Current User Profile
async function fetchCurrentUser() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      STATE.user = data.user;
      if (data.user.role === 'ADMIN') {
        showAdminView();
      } else {
        showUserView();
      }
    } else {
      handleLogout();
    }
  } catch (err) {
    console.error('Fetch me error:', err);
    handleLogout();
  }
}

async function refreshUserProfile() {
  await fetchCurrentUser();
  showToast('Profile status refreshed', 'info');
}

function handleLogout() {
  STATE.token = null;
  STATE.user = null;
  localStorage.removeItem('kp_token');
  showLandingView();
  showToast('Logged out successfully', 'info');
}

// ==============================================================
// USER PORTAL LOGIC
// ==============================================================

function updateUserDashboard() {
  if (!STATE.user) return;
  const user = STATE.user;

  // Wallet and Rate Display
  document.getElementById('user-card-balance').innerText = `₹${(user.wallet_balance || 0).toFixed(2)}`;
  document.getElementById('user-card-rate').innerText = `₹${(user.rate || 50).toFixed(2)}`;
  document.getElementById('sub-rate-display').innerText = `₹${(user.rate || 50).toFixed(2)}`;
  document.getElementById('sub-balance-display').innerText = `₹${(user.wallet_balance || 0).toFixed(2)}`;
  document.getElementById('user-banner-rate').innerText = `₹${(user.rate || 50).toFixed(2)}`;

  // Status Banners & Controls
  const isApproved = user.status === 'APPROVED';
  const pendingAlert = document.getElementById('user-pending-alert');
  const approvedAlert = document.getElementById('user-approved-alert');
  const lockedNotice = document.getElementById('submit-locked-notice');
  const submitForm = document.getElementById('form-submit-application');
  const userCardStatus = document.getElementById('user-card-status');
  const userCardStatusSub = document.getElementById('user-card-status-sub');

  if (isApproved) {
    pendingAlert.classList.add('hidden');
    approvedAlert.classList.remove('hidden');
    lockedNotice.classList.add('hidden');
    submitForm.classList.remove('opacity-40', 'pointer-events-none');
    userCardStatus.innerText = 'APPROVED';
    userCardStatus.className = 'text-xl font-bold uppercase tracking-wide text-emerald-400';
    userCardStatusSub.innerText = 'Verified customer account';
  } else {
    pendingAlert.classList.remove('hidden');
    approvedAlert.classList.add('hidden');
    lockedNotice.classList.remove('hidden');
    submitForm.classList.add('opacity-40', 'pointer-events-none');
    userCardStatus.innerText = user.status;
    userCardStatus.className = 'text-xl font-bold uppercase tracking-wide text-amber-400';
    userCardStatusSub.innerText = 'Waiting for admin approval & rate';
  }

  // Check balance warning
  const warn = document.getElementById('sub-insufficient-warning');
  const submitBtn = document.getElementById('btn-submit-application');
  if (isApproved && user.wallet_balance < (user.rate || 50)) {
    warn.classList.remove('hidden');
    submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
  } else {
    warn.classList.add('hidden');
    submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
  }

  loadUserSubmissions();
  loadUserTransactions();
}

function switchUserTab(tab) {
  STATE.activeUserTab = tab;
  const tabs = ['submit', 'history', 'wallet'];
  tabs.forEach(t => {
    const btn = document.getElementById(`tab-btn-${t}`);
    const view = document.getElementById(`user-tab-${t}`);
    if (t === tab) {
      btn.className = 'pb-3 text-indigo-400 border-b-2 border-indigo-500 font-bold flex items-center space-x-2';
      view.classList.remove('hidden');
    } else {
      btn.className = 'pb-3 text-slate-400 hover:text-slate-200 font-semibold flex items-center space-x-2';
      view.classList.add('hidden');
    }
  });
  lucide.createIcons();
}

function togglePasswordVisibility(inputId) {
  const input = document.getElementById(inputId);
  if (input.type === 'password') {
    input.type = 'text';
  } else {
    input.type = 'password';
  }
}

// User Application Submission
async function handleApplicationSubmit(e) {
  e.preventDefault();
  if (!STATE.user || STATE.user.status !== 'APPROVED') {
    showToast('Your account is pending admin approval. You cannot submit yet.', 'warning');
    return;
  }

  const userRate = STATE.user.rate || 50;
  if (STATE.user.wallet_balance < userRate) {
    showToast(`Insufficient balance! You need at least ₹${userRate.toFixed(2)}. Please top up your wallet.`, 'error');
    openTopupModal();
    return;
  }

  const appNo = document.getElementById('sub-app-no').value.trim();
  const dob = document.getElementById('sub-dob').value.trim();
  const password = document.getElementById('sub-password').value.trim();
  const serviceType = document.getElementById('sub-service-type').value;
  const userNotes = document.getElementById('sub-notes').value.trim();

  if (!appNo || !dob || !password) {
    showToast('Please fill all required fields (Application No, DOB & Password)', 'warning');
    return;
  }

  // Confirmation Prompt
  const confirmMsg = `Confirm Submission?\n\n• Application No: ${appNo}\n• Service Charge: ₹${userRate.toFixed(2)}\n• Wallet Balance After: ₹${(STATE.user.wallet_balance - userRate).toFixed(2)}\n\nClick OK to deduct ₹${userRate.toFixed(2)} and submit details.`;
  if (!confirm(confirmMsg)) return;

  const btn = document.getElementById('btn-submit-application');
  btn.disabled = true;
  btn.innerHTML = 'Submitting & Debiting Wallet...';

  try {
    const res = await fetch('/api/submissions/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({
        application_no: appNo,
        dob,
        password,
        service_type: serviceType,
        user_notes: userNotes
      })
    });
    const data = await res.json();

    if (data.success) {
      // Confetti effect!
      if (typeof confetti === 'function') {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
      }

      showToast(data.message, 'success');
      document.getElementById('form-submit-application').reset();

      // Show receipt
      showReceiptModal(data.data);

      // Refresh user state
      await fetchCurrentUser();
    } else {
      showToast(data.message || 'Submission failed', 'error');
    }
  } catch (err) {
    showToast('Network error during application submit', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Confirm & Submit Application (Deduct Rate from Wallet)</span>`;
    lucide.createIcons();
  }
}

// Receipt Modal
function showReceiptModal(subData) {
  document.getElementById('receipt-tracking-id').innerText = subData.trackingId;
  document.getElementById('receipt-date').innerText = new Date().toLocaleString();
  document.getElementById('receipt-app-no').innerText = subData.application_no;
  document.getElementById('receipt-dob').innerText = subData.dob;
  document.getElementById('receipt-service').innerText = subData.service_type;
  document.getElementById('receipt-amount').innerText = `₹${(subData.service_rate || 50).toFixed(2)}`;
  openModal('modal-receipt');
}

// Load User Submissions
async function loadUserSubmissions() {
  if (!STATE.token) return;
  try {
    const res = await fetch('/api/submissions/my-submissions', {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const container = document.getElementById('user-submissions-container');
      const countEl = document.getElementById('user-tab-count');
      const cardCount = document.getElementById('user-card-submissions');

      countEl.innerText = data.submissions.length;
      cardCount.innerText = data.submissions.length;

      if (data.submissions.length === 0) {
        container.innerHTML = `
          <div class="glass-card p-12 text-center rounded-2xl space-y-3">
            <div class="w-12 h-12 rounded-2xl bg-slate-800 text-slate-500 flex items-center justify-center mx-auto">
              <i data-lucide="inbox" class="w-6 h-6"></i>
            </div>
            <h4 class="font-bold text-sm text-slate-300">No Applications Submitted Yet</h4>
            <p class="text-xs text-slate-500 max-w-sm mx-auto">
              Submit candidate details (App No, DOB, Password) in the Submit tab to start processing.
            </p>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      container.innerHTML = data.submissions.map(sub => {
        const badgeClass = sub.status === 'COMPLETED' ? 'badge-completed' :
                           sub.status === 'PROCESSING' ? 'badge-processing' :
                           sub.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending';

        return `
          <div class="glass-card p-5 rounded-2xl space-y-3 border border-slate-800/80">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
              <div class="flex items-center space-x-2">
                <span class="font-mono text-xs font-bold text-indigo-400">${sub.tracking_id}</span>
                <span class="text-slate-500 text-xs">•</span>
                <span class="text-xs font-semibold text-slate-300">${sub.service_type}</span>
              </div>
              <div class="flex items-center space-x-2">
                <span class="text-[11px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${badgeClass}">${sub.status}</span>
                <span class="text-xs font-mono font-bold text-emerald-400">Paid: ₹${sub.service_rate.toFixed(2)}</span>
              </div>
            </div>

            <!-- Credentials Box -->
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2 bg-slate-900/60 p-3 rounded-xl text-xs font-mono">
              <div>
                <span class="text-slate-500">App No:</span>
                <strong class="text-white ml-1">${sub.application_no}</strong>
              </div>
              <div>
                <span class="text-slate-500">DOB:</span>
                <strong class="text-slate-200 ml-1">${sub.dob}</strong>
              </div>
              <div class="flex items-center justify-between">
                <div>
                  <span class="text-slate-500">Password:</span>
                  <span id="pass-mask-${sub.id}" class="text-amber-400 ml-1">••••••••</span>
                  <span id="pass-val-${sub.id}" class="hidden text-amber-400 ml-1 font-bold">${sub.password}</span>
                </div>
                <button onclick="toggleCardPass(${sub.id})" class="text-slate-500 hover:text-slate-300 text-[10px]">Show</button>
              </div>
            </div>

            <!-- Admin Remarks / Output -->
            ${sub.admin_remarks || sub.result_file || sub.result_url ? `
              <div class="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-xs space-y-1.5">
                <div class="font-bold text-indigo-300">Operator Remarks & Output:</div>
                ${sub.admin_remarks ? `<p class="text-slate-300">${sub.admin_remarks}</p>` : ''}
                <div class="flex flex-wrap gap-2 pt-1">
                  ${sub.result_file ? `
                    <a href="${sub.result_file}" target="_blank" download class="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-[11px]">
                      <i data-lucide="download" class="w-3.5 h-3.5"></i>
                      <span>Download Result Document</span>
                    </a>
                  ` : ''}
                  ${sub.result_url ? `
                    <a href="${sub.result_url}" target="_blank" class="inline-flex items-center space-x-1 px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px]">
                      <i data-lucide="external-link" class="w-3.5 h-3.5"></i>
                      <span>Open Result URL</span>
                    </a>
                  ` : ''}
                </div>
              </div>
            ` : ''}

            <div class="text-[10px] text-slate-500 flex justify-between">
              <span>Submitted: ${new Date(sub.created_at).toLocaleString()}</span>
              ${sub.user_notes ? `<span>Note: ${sub.user_notes}</span>` : ''}
            </div>
          </div>
        `;
      }).join('');

      lucide.createIcons();
    }
  } catch (err) {
    console.error('Load submissions error:', err);
  }
}

function toggleCardPass(id, valId) {
  if (valId) {
    const mask = document.getElementById(id);
    const val = document.getElementById(valId);
    if (mask && val) {
      mask.classList.toggle('hidden');
      val.classList.toggle('hidden');
    }
    return;
  }
  const mask = document.getElementById(`pass-mask-${id}`);
  const val = document.getElementById(`pass-val-${id}`);
  if (mask && val) {
    mask.classList.toggle('hidden');
    val.classList.toggle('hidden');
  }
}

// User Wallet Transactions
async function loadUserTransactions() {
  if (!STATE.token) return;
  try {
    const res = await fetch('/api/wallet/transactions', {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const tbody = document.getElementById('user-transactions-table');
      if (data.transactions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="py-6 text-center text-slate-500">No wallet transactions found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.transactions.map(tx => {
        const isCredit = tx.type === 'CREDIT';
        const color = isCredit ? 'text-emerald-400' : 'text-rose-400';
        const sign = isCredit ? '+' : '-';

        return `
          <tr class="hover:bg-slate-900/50">
            <td class="py-2.5 text-slate-400 font-mono">${new Date(tx.created_at).toLocaleDateString()}</td>
            <td class="py-2.5">
              <span class="px-2 py-0.5 rounded font-bold text-[10px] ${isCredit ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}">
                ${tx.type}
              </span>
            </td>
            <td class="py-2.5 text-slate-300">${tx.description}</td>
            <td class="py-2.5 text-right font-mono font-bold ${color}">${sign}₹${tx.amount.toFixed(2)}</td>
            <td class="py-2.5 text-right font-mono text-slate-400">₹${tx.balance_after.toFixed(2)}</td>
          </tr>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Load transactions error:', err);
  }
}

// ==============================================================
// TOP-UP & YOUPI PAYMENT GATEWAY LOGIC
// ==============================================================

function switchTopupMethod(method) {
  STATE.activeTopupMethod = method;
  const btnYoupi = document.getElementById('tab-topup-btn-youpi');
  const btnManual = document.getElementById('tab-topup-btn-manual');
  const boxYoupi = document.getElementById('method-youpi-box');
  const boxManual = document.getElementById('method-manual-box');

  if (method === 'youpi') {
    btnYoupi.className = 'py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1.5';
    btnManual.className = 'py-2.5 rounded-xl text-slate-400 hover:text-white font-semibold text-xs transition-all flex items-center justify-center space-x-1.5';
    boxYoupi.classList.remove('hidden');
    boxManual.classList.add('hidden');
  } else {
    btnManual.className = 'py-2.5 rounded-xl bg-indigo-600 text-white font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-1.5';
    btnYoupi.className = 'py-2.5 rounded-xl text-slate-400 hover:text-white font-semibold text-xs transition-all flex items-center justify-center space-x-1.5';
    boxManual.classList.remove('hidden');
    boxYoupi.classList.add('hidden');
  }
  lucide.createIcons();
}

function openTopupModal() {
  if (STATE.user && STATE.user.status !== 'APPROVED') {
    showToast('Your account is pending admin approval. You can top up once approved.', 'warning');
    return;
  }
  openModal('modal-topup');
  switchTopupMethod('youpi');
  generateQrCode(STATE.selectedTopupAmount);
}

function selectTopupAmount(amount) {
  STATE.selectedTopupAmount = amount;
  document.querySelectorAll('.topup-preset-btn').forEach(btn => {
    btn.classList.remove('bg-indigo-600/30', 'border-indigo-500', 'text-indigo-300');
    btn.classList.add('bg-slate-800', 'border-slate-700', 'text-white');
  });
  event.target.classList.remove('bg-slate-800', 'border-slate-700', 'text-white');
  event.target.classList.add('bg-indigo-600/30', 'border-indigo-500', 'text-indigo-300');
  
  document.getElementById('topup-custom-amount').value = '';
  generateQrCode(amount);
  
  // Hide active youpi checkout if amount changed
  document.getElementById('youpi-checkout-container').classList.add('hidden');
  document.getElementById('btn-start-youpi').classList.remove('hidden');
}

async function generateQrCode(amount) {
  const parsed = parseFloat(amount) || 100;
  STATE.selectedTopupAmount = parsed;
  document.getElementById('topup-display-amount').innerText = `Amount: ₹${parsed.toFixed(2)}`;

  try {
    const res = await fetch(`/api/wallet/qr?amount=${parsed}`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('topup-qr-img').src = data.qrDataUrl;
      document.getElementById('topup-display-upi-id').innerText = data.upiId;
    }
  } catch (err) {
    console.error('QR fetch error:', err);
  }
}

// Initiate YouPI-PG Gateway Payment Session
async function initiateYouPiPayment() {
  const btn = document.getElementById('btn-start-youpi');
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader" class="w-4 h-4 animate-spin"></i><span>Connecting to YouPI-PG...</span>`;
  lucide.createIcons();

  try {
    const res = await fetch('/api/wallet/youpi/create-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ amount: STATE.selectedTopupAmount })
    });
    const data = await res.json();

    if (data.success) {
      STATE.currentYoupiOrder = data;

      if (data.mode === 'YOUPI_LIVE' && data.checkoutUrl) {
        showToast('Redirecting to Live YouPI Checkout Portal...', 'info');
        window.open(data.checkoutUrl, '_blank');
        startYouPiPolling(data.orderId);
      } else {
        // Embedded YouPI Checkout Mode
        document.getElementById('btn-start-youpi').classList.add('hidden');
        const container = document.getElementById('youpi-checkout-container');
        container.classList.remove('hidden');

        document.getElementById('youpi-order-id').innerText = data.orderId;
        document.getElementById('youpi-checkout-amount').innerText = `₹${parseFloat(data.amount).toFixed(2)}`;
        document.getElementById('youpi-qr-img').src = data.qrDataUrl;
        document.getElementById('youpi-vpa-label').innerText = `${data.upiName} (${data.upiId})`;

        // Bind direct UPI app intent link
        const intentLink = document.getElementById('youpi-upi-intent-link');
        if (intentLink && data.upiUri) {
          intentLink.href = data.upiUri;
        }

        showToast('Payment session initialized. Scan QR or click Pay via UPI App.', 'success');
        startYouPiPolling(data.orderId);
      }
    } else {
      showToast(data.message || 'Failed to initiate YouPI session', 'error');
    }
  } catch (err) {
    showToast('Network error while connecting to YouPI-PG', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="zap" class="w-4 h-4 text-amber-300"></i><span>Pay & Recharge with YouPI-PG Gateway</span>`;
    lucide.createIcons();
  }
}

// Poll YouPI Order Status
let youpiPollInterval = null;
function startYouPiPolling(orderId) {
  if (youpiPollInterval) clearInterval(youpiPollInterval);
  youpiPollInterval = setInterval(async () => {
    try {
      const res = await fetch(`/api/wallet/youpi/status/${orderId}`, {
        headers: { 'Authorization': `Bearer ${STATE.token}` }
      });
      const data = await res.json();
      if (data.success && data.status === 'APPROVED') {
        clearInterval(youpiPollInterval);
        showToast(`Payment of ₹${data.amount} verified! Wallet balance: ₹${data.wallet_balance.toFixed(2)}`, 'success');
        if (typeof confetti === 'function') confetti({ particleCount: 80, spread: 60 });
        closeModal('modal-topup');
        await fetchCurrentUser();
      }
    } catch (e) {
      // Ignore polling errors
    }
  }, 3000);
}

// Submit Real YouPI UTR claim
async function submitYouPiUtrClaim() {
  const utr = document.getElementById('youpi-utr-input').value.trim();
  if (!utr || utr.length < 6) {
    showToast('Please enter the 12-digit UPI UTR from your payment screen', 'warning');
    return;
  }
  if (!STATE.currentYoupiOrder) return;

  const btn = document.getElementById('btn-submit-youpi-utr');
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span>Submitting...</span>`;
  }

  try {
    const res = await fetch('/api/wallet/youpi/submit-utr', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({
        orderId: STATE.currentYoupiOrder.orderId,
        utr: utr
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      if (data.status === 'APPROVED') {
        if (youpiPollInterval) clearInterval(youpiPollInterval);
        if (typeof confetti === 'function') confetti({ particleCount: 90, spread: 70 });
        closeModal('modal-topup');
        await fetchCurrentUser();
      } else {
        if (btn) {
          btn.innerHTML = `<i data-lucide="clock" class="w-4 h-4"></i><span>Under Verification</span>`;
        }
        // Start polling for admin or observer confirmation
        startYouPiPolling(STATE.currentYoupiOrder.orderId);
      }
    } else {
      showToast(data.message || 'UTR submission failed', 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Submit UTR</span>`;
      }
    }
    lucide.createIcons();
  } catch (err) {
    showToast('Network error during UTR submission', 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Submit UTR</span>`;
      lucide.createIcons();
    }
  }
}

// Simulate Instant YouPI Success (Test mode)
async function simulateYouPiSuccessPayment() {
  if (!STATE.currentYoupiOrder) {
    showToast('Please initiate a YouPI payment session first', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/wallet/youpi/simulate-payment', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({
        orderId: STATE.currentYoupiOrder.orderId,
        event: 'RECONCILED'
      })
    });
    const data = await res.json();
    if (data.success) {
      if (youpiPollInterval) clearInterval(youpiPollInterval);
      showToast(data.message, 'success');
      if (typeof confetti === 'function') confetti({ particleCount: 100, spread: 80 });
      closeModal('modal-topup');
      await fetchCurrentUser();
    } else {
      showToast(data.message || 'Payment simulation failed', 'error');
    }
  } catch (err) {
    showToast('Network error during simulation', 'error');
  }
}

// Manual Top-up Submission
async function handleTopupSubmit(e) {
  e.preventDefault();
  const utr = document.getElementById('topup-utr').value.trim();
  const fileInput = document.getElementById('topup-screenshot');

  if (!utr || utr.length < 6) {
    showToast('Please provide a valid UTR / Transaction Reference ID', 'warning');
    return;
  }

  const formData = new FormData();
  formData.append('amount', STATE.selectedTopupAmount);
  formData.append('utr', utr);
  if (fileInput.files[0]) {
    formData.append('screenshot', fileInput.files[0]);
  }

  const btn = document.getElementById('btn-submit-topup');
  btn.disabled = true;
  btn.innerHTML = 'Submitting Request...';

  try {
    const res = await fetch('/api/wallet/topup', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STATE.token}` },
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-topup');
      document.getElementById('form-topup-utr').reset();
      switchUserTab('wallet');
      await loadUserTransactions();
    } else {
      showToast(data.message || 'Error submitting topup', 'error');
    }
  } catch (err) {
    showToast('Network error during topup submission', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<i data-lucide="check-circle" class="w-4 h-4"></i><span>Submit Manual Top-Up Verification</span>`;
    lucide.createIcons();
  }
}

// ==============================================================
// ADMIN CONTROL PANEL LOGIC
// ==============================================================

function switchAdminTab(tab) {
  STATE.activeAdminTab = tab;
  const tabs = ['users', 'submissions', 'topups', 'settings'];
  tabs.forEach(t => {
    const btn = document.getElementById(`admin-tab-btn-${t}`);
    const view = document.getElementById(`admin-tab-${t}`);
    if (t === tab) {
      btn.className = 'pb-3 text-indigo-400 border-b-2 border-indigo-500 font-bold flex items-center space-x-2';
      view.classList.remove('hidden');
    } else {
      btn.className = 'pb-3 text-slate-400 hover:text-slate-200 font-semibold flex items-center space-x-2';
      view.classList.add('hidden');
    }
  });

  if (tab === 'users') loadAdminUsers();
  if (tab === 'submissions') loadAdminSubmissions();
  if (tab === 'topups') loadAdminTopups();
  if (tab === 'settings') loadSettingsForm();
  lucide.createIcons();
}

async function loadAdminStats() {
  try {
    const res = await fetch('/api/admin/stats', {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('admin-stat-pending-users').innerText = data.stats.pendingUsers;
      document.getElementById('admin-stat-total-users').innerText = data.stats.totalUsers;
      document.getElementById('admin-stat-pending-sub').innerText = data.stats.pendingSubmissions;
      document.getElementById('admin-stat-pending-topups').innerText = data.stats.pendingTopups;
      document.getElementById('admin-stat-revenue').innerText = `₹${data.stats.totalRevenue.toFixed(2)}`;
    }
  } catch (err) {
    console.error('Stats error:', err);
  }
}

// Admin: Load Users List
async function loadAdminUsers() {
  const filter = document.getElementById('admin-user-filter').value;
  try {
    const res = await fetch(`/api/admin/users?status=${filter}`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const tbody = document.getElementById('admin-users-table');
      document.getElementById('admin-user-count-label').innerText = `Showing ${data.users.length} users`;

      if (data.users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-8 text-center text-slate-500">No users found for this filter.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.users.map(u => {
        const isPending = u.status === 'PENDING';
        const badgeClass = isPending ? 'badge-pending' : u.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';

        return `
          <tr class="hover:bg-slate-900/50 transition-colors ${isPending ? 'bg-amber-500/5' : ''}">
            <td class="py-3 px-4">
              <div class="font-bold text-white text-xs">${u.name}</div>
              <div class="font-mono text-slate-400 text-[11px]">+91 ${u.phone}</div>
            </td>
            <td class="py-3 px-4 text-slate-400 text-xs font-mono">
              ${new Date(u.created_at).toLocaleDateString()}
            </td>
            <td class="py-3 px-4">
              <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                ${u.status}
              </span>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-indigo-400 text-xs">
              ₹${(u.rate || 50).toFixed(2)}
              <button onclick="promptEditRate(${u.id}, ${u.rate || 50})" class="ml-1 text-[10px] text-slate-500 hover:text-indigo-300 underline font-sans">Edit</button>
            </td>
            <td class="py-3 px-4 font-mono font-bold text-emerald-400 text-xs">
              ₹${(u.wallet_balance || 0).toFixed(2)}
            </td>
            <td class="py-3 px-4 text-right space-x-1.5 whitespace-nowrap">
              ${isPending ? `
                <button onclick="openApproveModal(${u.id}, '${u.name}', '${u.phone}', ${u.rate || 50})" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all inline-flex items-center space-x-1">
                  <i data-lucide="check" class="w-3.5 h-3.5"></i>
                  <span>Approve & Set Rate</span>
                </button>
              ` : `
                <button onclick="openAdjustWalletModal(${u.id}, '${u.name}', ${u.wallet_balance})" title="Adjust Wallet" class="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs">
                  ± Wallet
                </button>
                <button onclick="toggleUserBlock(${u.id}, '${u.status}')" class="px-2 py-1 rounded text-xs ${u.status === 'BLOCKED' ? 'bg-emerald-900/40 text-emerald-300 border border-emerald-700' : 'bg-rose-900/40 text-rose-300 border border-rose-700'}">
                  ${u.status === 'BLOCKED' ? 'Unblock' : 'Block'}
                </button>
              `}
            </td>
          </tr>
        `;
      }).join('');

      lucide.createIcons();
    }
  } catch (err) {
    console.error('Admin users load error:', err);
  }
}

// Open Approval Modal
function openApproveModal(userId, name, phone, currentRate) {
  document.getElementById('modal-approve-user-id').value = userId;
  document.getElementById('modal-approve-name').innerText = name;
  document.getElementById('modal-approve-phone').innerText = `+91 ${phone}`;
  document.getElementById('modal-approve-rate').value = currentRate || 50;
  openModal('modal-admin-approve');
}

// Handle Approve User Form Submit
async function handleApproveUserSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('modal-approve-user-id').value;
  const rate = parseFloat(document.getElementById('modal-approve-rate').value);
  const notes = document.getElementById('modal-approve-notes').value.trim();

  if (isNaN(rate) || rate < 0) {
    showToast('Please enter a valid rate (₹0 or greater)', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}/approve`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ rate, admin_notes: notes })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-admin-approve');
      loadAdminUsers();
      loadAdminStats();
    } else {
      showToast(data.message || 'Error approving user', 'error');
    }
  } catch (err) {
    showToast('Network error during user approval', 'error');
  }
}

// Prompt Edit Rate
async function promptEditRate(userId, currentRate) {
  const newRate = prompt('Enter new service rate per submission (₹):', currentRate);
  if (newRate === null) return;
  const parsed = parseFloat(newRate);
  if (isNaN(parsed) || parsed < 0) {
    showToast('Invalid rate entered', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}/update-rate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ rate: parsed })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminUsers();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Failed to update rate', 'error');
  }
}

// Toggle User Block
async function toggleUserBlock(userId, currentStatus) {
  const newStatus = currentStatus === 'BLOCKED' ? 'APPROVED' : 'BLOCKED';
  if (!confirm(`Are you sure you want to change user status to ${newStatus}?`)) return;

  try {
    const res = await fetch(`/api/admin/users/${userId}/status`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ status: newStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      loadAdminUsers();
    }
  } catch (err) {
    showToast('Status update failed', 'error');
  }
}

// Manual Wallet Adjust Modal
function openAdjustWalletModal(userId, name, currentBalance) {
  document.getElementById('modal-adjust-user-id').value = userId;
  document.getElementById('modal-adjust-user-label').innerText = `User: ${name} (Current: ₹${currentBalance.toFixed(2)})`;
  document.getElementById('form-adjust-wallet').reset();
  openModal('modal-admin-wallet-adjust');
}

async function handleAdjustWalletSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('modal-adjust-user-id').value;
  const type = document.querySelector('input[name="adjust-type"]:checked').value;
  const amount = parseFloat(document.getElementById('modal-adjust-amount').value);
  const reason = document.getElementById('modal-adjust-reason').value.trim();

  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/admin/users/${userId}/adjust-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ type, amount, reason })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-admin-wallet-adjust');
      loadAdminUsers();
      loadAdminStats();
    } else {
      showToast(data.message || 'Error adjusting wallet', 'error');
    }
  } catch (err) {
    showToast('Network error during wallet adjustment', 'error');
  }
}

// Admin: Load Submissions
async function loadAdminSubmissions() {
  const filter = document.getElementById('admin-sub-filter').value;
  try {
    const res = await fetch(`/api/admin/submissions?status=${filter}`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const tbody = document.getElementById('admin-submissions-table');
      document.getElementById('admin-sub-count-label').innerText = `${data.submissions.length} submissions`;

      if (data.submissions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-500">No submissions found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.submissions.map(s => {
        const badgeClass = s.status === 'COMPLETED' ? 'badge-completed' :
                           s.status === 'PROCESSING' ? 'badge-processing' :
                           s.status === 'REJECTED' ? 'badge-rejected' : 'badge-pending';

        return `
          <tr class="hover:bg-slate-900/50 transition-colors">
            <td class="py-3 px-4">
              <div class="font-bold text-indigo-400 text-xs">${s.tracking_id}</div>
              <div class="text-[10px] text-slate-500">${new Date(s.created_at).toLocaleString()}</div>
            </td>
            <td class="py-3 px-4 font-sans">
              <div class="font-bold text-white text-xs">${s.user_name}</div>
              <div class="text-[11px] text-slate-400 font-mono">+91 ${s.user_phone}</div>
            </td>
            <td class="py-3 px-4 text-xs font-bold text-white">
              <span>${s.application_no}</span>
              <button onclick="copyToClipboard('${s.application_no}', 'App No')" class="ml-1 text-slate-500 hover:text-indigo-400 text-[10px] font-sans">Copy</button>
            </td>
            <td class="py-3 px-4 text-xs text-slate-300">
              ${s.dob}
            </td>
            <td class="py-3 px-4 text-xs">
              <span id="admin-pass-mask-${s.id}" class="text-amber-400">••••••••</span>
              <span id="admin-pass-val-${s.id}" class="hidden text-amber-400 font-bold">${s.password}</span>
              <div class="space-x-1 text-[10px] font-sans text-slate-500">
                <button onclick="toggleCardPass('admin-pass-mask-${s.id}', 'admin-pass-val-${s.id}')" class="hover:text-slate-300">Show</button>
                <span>•</span>
                <button onclick="copyToClipboard('${s.password}', 'Password')" class="hover:text-indigo-400">Copy</button>
              </div>
            </td>
            <td class="py-3 px-4 font-sans text-xs">
              <div class="text-slate-200">${s.service_type}</div>
              <div class="text-emerald-400 font-mono font-bold text-[11px]">Fee: ₹${s.service_rate.toFixed(2)}</div>
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                ${s.status}
              </span>
            </td>
            <td class="py-3 px-4 text-right font-sans whitespace-nowrap">
              <button onclick="openSubmissionUpdateModal(${s.id}, '${s.tracking_id}', '${s.application_no}', '${s.dob}', '${s.password}', '${s.status}', '${(s.admin_remarks || '').replace(/'/g, "\\'")}')" class="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md shadow-indigo-600/20">
                Process / Update
              </button>
            </td>
          </tr>
        `;
      }).join('');

      lucide.createIcons();
    }
  } catch (err) {
    console.error('Submissions load error:', err);
  }
}

function openSubmissionUpdateModal(id, tracking, appNo, dob, pass, currentStatus, remarks) {
  document.getElementById('modal-sub-update-id').value = id;
  document.getElementById('modal-sub-update-tracking').innerText = `Tracking ID: ${tracking}`;
  document.getElementById('modal-sub-details-appno').innerText = appNo;
  document.getElementById('modal-sub-details-dob').innerText = dob;
  document.getElementById('modal-sub-details-pass').innerText = pass;
  document.getElementById('modal-sub-new-status').value = currentStatus === 'PENDING' ? 'PROCESSING' : currentStatus;
  document.getElementById('modal-sub-remarks').value = remarks || '';
  toggleRefundOption(document.getElementById('modal-sub-new-status').value);
  openModal('modal-admin-submission-update');
}

function toggleRefundOption(status) {
  const box = document.getElementById('modal-sub-refund-box');
  if (status === 'REJECTED') {
    box.classList.remove('hidden');
  } else {
    box.classList.add('hidden');
  }
}

async function handleSubmissionStatusSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('modal-sub-update-id').value;
  const status = document.getElementById('modal-sub-new-status').value;
  const remarks = document.getElementById('modal-sub-remarks').value.trim();
  const resultUrl = document.getElementById('modal-sub-result-url').value.trim();
  const fileInput = document.getElementById('modal-sub-file');
  const refundFee = document.getElementById('modal-sub-refund-check').checked;

  const formData = new FormData();
  formData.append('status', status);
  formData.append('admin_remarks', remarks);
  formData.append('result_url', resultUrl);
  formData.append('refund_fee', refundFee);
  if (fileInput.files[0]) {
    formData.append('result_file', fileInput.files[0]);
  }

  try {
    const res = await fetch(`/api/admin/submissions/${id}/update-status`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STATE.token}` },
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      closeModal('modal-admin-submission-update');
      loadAdminSubmissions();
      loadAdminStats();
    } else {
      showToast(data.message || 'Error updating status', 'error');
    }
  } catch (err) {
    showToast('Network error during status update', 'error');
  }
}

// Admin: Load Topup Requests
async function loadAdminTopups() {
  const filter = document.getElementById('admin-topup-filter').value;
  try {
    const res = await fetch(`/api/admin/topups?status=${filter}`, {
      headers: { 'Authorization': `Bearer ${STATE.token}` }
    });
    const data = await res.json();

    if (data.success) {
      const tbody = document.getElementById('admin-topups-table');
      document.getElementById('admin-topup-count-label').innerText = `${data.topups.length} requests`;

      if (data.topups.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="p-8 text-center text-slate-500">No top-up requests found.</td></tr>`;
        return;
      }

      tbody.innerHTML = data.topups.map(t => {
        const isPending = t.status === 'PENDING';
        const badgeClass = isPending ? 'badge-pending' : t.status === 'APPROVED' ? 'badge-approved' : 'badge-rejected';

        return `
          <tr class="hover:bg-slate-900/50 transition-colors">
            <td class="py-3 px-4 text-xs font-mono text-slate-400">
              <div>${new Date(t.created_at).toLocaleString()}</div>
              <span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold ${t.payment_method === 'YOUPI_PG' ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30' : 'bg-slate-800 text-slate-400'}">
                ${t.payment_method || 'UPI'}
              </span>
            </td>
            <td class="py-3 px-4 text-xs">
              <div class="font-bold text-white">${t.user_name}</div>
              <div class="text-[11px] font-mono text-slate-400">+91 ${t.user_phone}</div>
            </td>
            <td class="py-3 px-4 font-mono font-black text-emerald-400 text-sm">
              ₹${t.amount.toFixed(2)}
            </td>
            <td class="py-3 px-4 font-mono font-bold text-xs text-white">
              <div>${t.utr || t.order_id || '-'}</div>
              ${t.utr ? `<button onclick="copyToClipboard('${t.utr}', 'UTR')" class="text-[10px] text-slate-500 hover:text-indigo-400 font-sans">Copy UTR</button>` : ''}
              ${t.gateway_payment_id ? `<div class="text-[10px] text-slate-500 truncate max-w-[120px]" title="${t.gateway_payment_id}">ID: ${t.gateway_payment_id}</div>` : ''}
            </td>
            <td class="py-3 px-4 text-xs">
              ${t.screenshot_path ? `
                <a href="${t.screenshot_path}" target="_blank" class="text-indigo-400 hover:underline font-semibold">View Screenshot</a>
              ` : '<span class="text-slate-500">None</span>'}
            </td>
            <td class="py-3 px-4">
              <span class="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${badgeClass}">
                ${t.status}
              </span>
              ${t.gateway_status ? `<div class="text-[10px] text-slate-500 mt-0.5">${t.gateway_status}</div>` : ''}
            </td>
            <td class="py-3 px-4 text-right space-x-2 whitespace-nowrap">
              ${isPending ? `
                <button onclick="processTopup(${t.id}, 'APPROVE', ${t.amount})" class="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20">
                  Approve & Credit
                </button>
                <button onclick="processTopup(${t.id}, 'REJECT', ${t.amount})" class="px-2.5 py-1.5 rounded-lg bg-rose-600/20 hover:bg-rose-600/30 text-rose-300 border border-rose-500/30 text-xs font-bold">
                  Reject
                </button>
              ` : `
                <span class="text-[11px] text-slate-500">${t.admin_remarks || 'Processed'}</span>
              `}
            </td>
          </tr>
        `;
      }).join('');

      lucide.createIcons();
    }
  } catch (err) {
    console.error('Load topups error:', err);
  }
}

async function processTopup(id, action, amount) {
  const remarks = prompt(action === 'APPROVE' ? `Approve top-up of ₹${amount}? Enter optional remark:` : 'Enter rejection reason:');
  if (remarks === null) return;

  try {
    const res = await fetch(`/api/admin/topups/${id}/process`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({ action, remarks })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      loadAdminTopups();
      loadAdminStats();
    } else {
      showToast(data.message || 'Error processing topup', 'error');
    }
  } catch (err) {
    showToast('Failed to process topup', 'error');
  }
}

// Admin: System Settings
function loadSettingsForm() {
  if (STATE.settings) {
    document.getElementById('setting-default-rate').value = STATE.settings.default_rate || 50;
    document.getElementById('setting-upi-id').value = STATE.settings.upi_id || 'kpcyber@upi';
    document.getElementById('setting-upi-name').value = STATE.settings.upi_name || 'KP Cyber Services';
    document.getElementById('setting-support-phone').value = STATE.settings.support_phone || '+91 98765 43210';
    document.getElementById('setting-portal-name').value = STATE.settings.portal_name || 'KP Cyber Service Portal';

    // YouPI Settings
    const apiUrlEl = document.getElementById('setting-youpi-api-url');
    if (apiUrlEl) apiUrlEl.value = STATE.settings.youpi_api_url || 'http://localhost:7000';
    const merchantIdEl = document.getElementById('setting-youpi-merchant-id');
    if (merchantIdEl) merchantIdEl.value = STATE.settings.youpi_merchant_id || '00000000-0000-0000-0000-000000000001';
    const apiKeyEl = document.getElementById('setting-youpi-api-key');
    if (apiKeyEl) apiKeyEl.value = STATE.settings.youpi_merchant_api_key || 'yp_test_key_kpcyber_2026';
    const whSecEl = document.getElementById('setting-youpi-webhook-secret');
    if (whSecEl) whSecEl.value = STATE.settings.youpi_webhook_secret || 'yp_whsec_kpcyber_2026';

    // SMS Settings
    const smsProvEl = document.getElementById('setting-sms-provider');
    if (smsProvEl) smsProvEl.value = STATE.settings.sms_provider || 'SIMULATOR';
    const fast2smsEl = document.getElementById('setting-fast2sms-api-key');
    if (fast2smsEl) fast2smsEl.value = STATE.settings.fast2sms_api_key || '';
    const twoFactorEl = document.getElementById('setting-twofactor-api-key');
    if (twoFactorEl) twoFactorEl.value = STATE.settings.twofactor_api_key || '';
    const twilioSidEl = document.getElementById('setting-twilio-sid');
    if (twilioSidEl) twilioSidEl.value = STATE.settings.twilio_account_sid || '';
    const twilioTokEl = document.getElementById('setting-twilio-token');
    if (twilioTokEl) twilioTokEl.value = STATE.settings.twilio_auth_token || '';
    const twilioPhoneEl = document.getElementById('setting-twilio-phone');
    if (twilioPhoneEl) twilioPhoneEl.value = STATE.settings.twilio_from_phone || '';
  }
}

async function handleSettingsUpdate(e) {
  e.preventDefault();
  const default_rate = document.getElementById('setting-default-rate').value;
  const upi_id = document.getElementById('setting-upi-id').value.trim();
  const upi_name = document.getElementById('setting-upi-name').value.trim();
  const support_phone = document.getElementById('setting-support-phone').value.trim();
  const portal_name = document.getElementById('setting-portal-name').value.trim();

  // YouPI Settings
  const youpi_api_url = (document.getElementById('setting-youpi-api-url')?.value || '').trim();
  const youpi_merchant_id = (document.getElementById('setting-youpi-merchant-id')?.value || '').trim();
  const youpi_merchant_api_key = (document.getElementById('setting-youpi-api-key')?.value || '').trim();
  const youpi_webhook_secret = (document.getElementById('setting-youpi-webhook-secret')?.value || '').trim();

  // SMS Settings
  const sms_provider = document.getElementById('setting-sms-provider')?.value || 'SIMULATOR';
  const fast2sms_api_key = (document.getElementById('setting-fast2sms-api-key')?.value || '').trim();
  const twofactor_api_key = (document.getElementById('setting-twofactor-api-key')?.value || '').trim();
  const twilio_account_sid = (document.getElementById('setting-twilio-sid')?.value || '').trim();
  const twilio_auth_token = (document.getElementById('setting-twilio-token')?.value || '').trim();
  const twilio_from_phone = (document.getElementById('setting-twilio-phone')?.value || '').trim();

  try {
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${STATE.token}`
      },
      body: JSON.stringify({
        default_rate,
        upi_id,
        upi_name,
        support_phone,
        portal_name,
        youpi_api_url,
        youpi_merchant_id,
        youpi_merchant_api_key,
        youpi_webhook_secret,
        sms_provider,
        fast2sms_api_key,
        twofactor_api_key,
        twilio_account_sid,
        twilio_auth_token,
        twilio_from_phone
      })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      await loadPublicSettings();
    } else {
      showToast(data.message || 'Error saving settings', 'error');
    }
  } catch (err) {
    showToast('Failed to update settings', 'error');
  }
}
