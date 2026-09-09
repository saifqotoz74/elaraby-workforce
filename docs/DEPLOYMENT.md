# Elaraby Connect — Deployment & Operations Runbook

**System:** Elaraby Connect Production Infrastructure  
**Targets:** Node.js Backend Microservice & Flutter Android/iOS Distribution  
**Version:** 1.0.0 (Production Deployment)  
**Date:** September 2026  

---

## 1. Prerequisites & Environment Variables

### 1.1 Mandatory Production Environment Variables

Never deploy to production with development defaults. The backend validates these on startup:

| Variable | Required | Description | Production Example |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | **YES** | Environment profile | `production` |
| `PORT` | **YES** | HTTP listen port | `4000` |
| `JWT_SECRET` | **YES** | Min 32-char cryptographically secure key | `openssl rand -hex 32` |
| `ADMIN_USER` | **YES** | HR superadmin username | `elaraby_hr_admin` |
| `ADMIN_PASS` | **YES** | Strong superadmin password (min 12 chars) | `K9#m$X8!vQ2@zL` |
| `DATA_PATH` | **YES** | Absolute path to persistent database volume | `/var/data/elaraby` |
| `CORS_ORIGINS` | **YES** | Comma-separated allowed web origins | `https://admin.elarabygroup.com` |
| `APP_UPDATE_URL` | NO | Download URL for mandatory updates | `https://app.elarabygroup.com` |
| `ALLOW_EPHEMERAL_STORAGE` | NO | Set `true` only for preview/testing | `false` |

---

## 2. Backend Deployment Procedures

### 2.1 Docker / Containerized Production Deployment

1. **Configure Environment:**
   ```bash
   cd server
   cp .env.production.example .env
   # Edit .env and configure real production secrets
   ```
2. **Launch with Docker Compose:**
   ```bash
   docker compose -f docker-compose.prod.yml up -d --build
   ```
3. **Verify Container Health:**
   ```bash
   curl -f http://localhost:4000/api/health
   # Expected response: {"ok":true,"status":"healthy",...}
   ```

### 2.2 Standard Linux Host / PM2 Process Manager

1. **Install Dependencies:**
   ```bash
   cd server
   npm ci --omit=dev
   ```
2. **Execute Schema Migrations & Startup:**
   ```bash
   pm2 start server.js --name "elaraby-backend" -i max --env production
   pm2 save
   ```

---

## 3. Mobile Client Release Procedures

### 3.1 Android Production Keystore Configuration

Ensure `android/key.properties` exists locally on the build machine (never commit to version control):
```properties
storePassword=YOUR_SECURE_STORE_PASSWORD
keyPassword=YOUR_SECURE_KEY_PASSWORD
keyAlias=elaraby_upload_key
storeFile=/path/to/elaraby_release.jks
```

### 3.2 Build Release APK & AAB (App Bundle)

1. **Clean workspace:**
   ```bash
   flutter clean
   flutter pub get
   ```
2. **Build Google Play App Bundle (.aab):**
   ```bash
   flutter build appbundle --release --dart-define=API_BASE_URL=https://api.elarabygroup.com/api
   ```
3. **Build Enterprise Direct APK (.apk):**
   ```bash
   flutter build apk --release --dart-define=API_BASE_URL=https://api.elarabygroup.com/api
   # Output: build/app/outputs/flutter-apk/app-release.apk
   ```

---

## 4. Post-Deployment Smoke Verification

Execute following verification commands immediately after deployment:

1. **Health Check:**
   `curl https://api.elarabygroup.com/api/health` -> Must return `{"ok": true, "status": "healthy"}`
2. **Version Check:**
   `curl https://api.elarabygroup.com/api/app/version` -> Must return valid version manifest.
3. **Superadmin Login:**
   Verify `POST /api/admin/login` accepts configured admin credentials and issues superadmin JWT.
4. **Mobile Login Smoke Test:**
   Open the mobile app, enter employee National ID, verify OTP entry, enter PIN, and verify dashboard renders.

---

## 5. Rollback Procedures

### 5.1 Backend Service Rollback
If a defect is detected post-deployment:
1. **Revert Application Binary / Container:**
   ```bash
   git checkout <PREVIOUS_RELEASE_TAG>
   docker compose restart
   # Or with PM2:
   pm2 restart elaraby-backend
   ```
2. **Restore Database from Backup Snapshot:**
   ```bash
   cp /var/data/elaraby/db.backup.json /var/data/elaraby/db.json
   pm2 restart elaraby-backend
   ```

### 5.2 Mobile App Force-Update Rollback
If a faulty mobile app release was distributed:
1. Access the Admin Dashboard -> App Version Management.
2. Set `minVersion` to the previous stable release (or set `forceUpdate: true` pointing to the updated APK).
3. The mobile application will immediately block usage on launch and display the mandatory update screen directing users to download the corrected package.
