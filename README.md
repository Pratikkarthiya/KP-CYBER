# KP CYBER - Digital Service Provider Portal
### Live with Cloudflare, Real Mobile OTP & [YouPI-PG Gateway](https://github.com/youpi-pg/YouPI-PG.git)

---

## 🌐 Live URLs

- **Live Cloudflare HTTPS URL**: **https://hydrogen-tract-alert-valley.trycloudflare.com**
- **Local URL**: **http://localhost:3000**
- **Features**: Automatic HTTPS, Cloudflare DDoS mitigation, edge caching, zero open router ports.

---

## 🔑 Default Administrator Credentials

| Role | Username / Mobile | Password |
| :--- | :--- | :--- |
| **Super Admin** | `9876543210` | `admin123` |

---

## 📱 Real SMS OTP Authentication Setup

In the **Admin Control Panel** $\rightarrow$ **Portal Settings** $\rightarrow$ **Mobile OTP & SMS Provider Setup**, you can select:

1. **Simulator (Dev Mode)**: Displays generated OTP on screen with 1-click Auto-fill.
2. **Fast2SMS (Recommended for India)**:
   - Create an account on [Fast2SMS](https://fast2sms.com)
   - Paste your API Key in **Fast2SMS Authorization API Key**
   - Direct OTP route dispatches real SMS to any Indian mobile number (`+91`).
3. **2Factor.in**:
   - Create an account on [2Factor.in](https://2factor.in)
   - Enter your 2Factor API Key.
4. **Twilio**:
   - Enter `Account SID`, `Auth Token`, and `Sender Phone`.

---

## 💳 YouPI-PG Sovereign Payment Gateway Setup

- **YouPI Webhook Endpoint**:
  ```
  https://hydrogen-tract-alert-valley.trycloudflare.com/api/webhooks/youpi
  ```
- **Webhook Security**: Authoritative **HMAC-SHA256** signature verification (`X-Gateway-Signature`).
- **Automated Settlement**: Automatically credits the customer's wallet upon receiving `RECONCILED` or `SUCCESS` events.
- **Admin Settings**:
  - `YOUPI_API_URL`: `http://localhost:7000` (or your live YouPI server URL)
  - `YOUPI_MERCHANT_ID`: Your merchant UUID
  - `YOUPI_MERCHANT_API_KEY`: Your private merchant API key
  - `YOUPI_WEBHOOK_SECRET`: Your webhook HMAC secret

---

## 🗄️ Database with Cloudflare

1. **Current Production-Grade Architecture**:
   - SQLite with Write-Ahead Logging (WAL) and atomic transactions.
   - Hosted behind **Cloudflare Zero Trust Tunnel** (`cloudflared`).
2. **Cloudflare D1 Serverless Setup**:
   - Schema file available at [`cloudflare/schema.sql`](file:///e:/KP%20CYBER/cloudflare/schema.sql).
   - Wrangler config available at [`cloudflare/wrangler.toml`](file:///e:/KP%20CYBER/cloudflare/wrangler.toml).
   - Execute to initialize Cloudflare D1:
     ```powershell
     npx wrangler d1 create kp-cyber-db
     npx wrangler d1 execute kp-cyber-db --file=cloudflare/schema.sql
     ```
3. **Custom Domain Cloudflare Tunnel Configuration**:
   - See [`cloudflare/tunnel-config.yml`](file:///e:/KP%20CYBER/cloudflare/tunnel-config.yml) to point your domain (e.g. `portal.yourdomain.com`).
