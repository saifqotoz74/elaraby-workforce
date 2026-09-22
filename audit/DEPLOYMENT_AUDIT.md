# DEPLOYMENT & DEVOPS AUDIT REPORT: Workforce OS

**Classification**: DevOps, Infrastructure & Release Pipeline Audit  
**Auditor**: Principal Site Reliability Engineer (SRE) & Release Architect  
**Date**: September 22, 2026  
**Target**: `Workforce OS` (`vercel.json`, `server/Dockerfile`, `docker-compose.yml`, `android/`, `ios/`)  

---

## 1. Executive Summary

This deployment audit reviews containerization, serverless configurations, environment variable validations, mobile packaging pipelines, and production operational safeguards.

The audit identifies **critical production hazards in the current deployment posture**:
* The server is configured for deployment to **Vercel Serverless**, an ephemeral serverless runtime where the application's file-based database (`/tmp/db.json`) is wiped on every lambda container recycle.
* Production validation gates are explicitly suppressed when `process.env.VERCEL` is detected.
* Mobile release manifests for iOS (`Info.plist`) and Android (`build.gradle`) contain fatal compliance and security defects that will cause immediate iOS crashes and leave Android code completely exposed.

---

## 2. Infrastructure & Containerization Assessment

### 2.1 Serverless Deployment Anti-Pattern (`vercel.json`)
The repository includes a `vercel.json` configuring a serverless Node.js lambda function.
* **The Fatal Flaw (DATA-001)**:
  In `server/src/db.js:25`:
  ```javascript
  const DATA_DIR = process.env.VERCEL ? '/tmp' : path.join(__dirname, '..', 'data');
  ```
  And in `server/src/config.js:142-155`:
  ```javascript
  if (process.env.VERCEL) {
    console.warn('⚠️  [VERCEL WARNING] Running with fallback config on Vercel serverless.');
    return; // Completely bypasses validateProductionConfig()!
  }
  ```
* **Production Consequence**:
  Vercel functions are stateless and spin down when idle. Any data written to `/tmp` disappears permanently when the container shuts down. If an HR administrator enters employee records, payslips, or shift schedules on Vercel, the next worker checking the app 15 minutes later will see an empty database.
* **Verdict**: **CRITICAL PRODUCTION BLOCKER**. Vercel cannot be used with the file-based database.

### 2.2 Docker & Containerization (`server/Dockerfile` & `docker-compose.yml`)
In contrast to Vercel, the Docker container configuration is well-structured:
* Uses official lightweight base `node:20-alpine` (or `node:22-alpine`).
* Employs non-root user execution (`USER node`).
* Properly isolates volume mounts for persistent data (`workforce-data:/app/data`).
* Exposes standard health probes (`/health/live` and `/health/ready`).
* **Verdict**: Docker / Kubernetes deployment is vastly superior to Vercel and is the only currently viable deployment target for the file-based engine.

---

## 3. Mobile Packaging & Platform Compliance

### 3.1 iOS Packaging Defects (`ios/Runner/Info.plist`)
* **Finding ID**: IOS-001
* **Severity**: **HIGH**
* **Defect**: The application utilizes plugins requiring hardware permissions (`camera`, `geolocator`, `image_picker`), but `ios/Runner/Info.plist` is missing the mandatory usage description keys:
  - `NSCameraUsageDescription`
  - `NSLocationWhenInUseUsageDescription`
  - `NSPhotoLibraryUsageDescription`
* **Consequences**:
  1. **Apple App Store Rejection**: Automated Apple App Store Connect validation will reject the `.ipa` upload immediately.
  2. **Runtime Crash (`SIGABRT`)**: If run on a real iOS device or TestFlight, the iOS OS terminates the application process immediately when permission is requested.
* **Required Fix**: Insert bilingual descriptions in `ios/Runner/Info.plist`:
  ```xml
  <key>NSCameraUsageDescription</key>
  <string>Workforce OS requires camera access to scan attendance QR codes on the factory floor.</string>
  <key>NSLocationWhenInUseUsageDescription</key>
  <string>Workforce OS requires location access to verify attendance within authorized factory geofences.</string>
  <key>NSPhotoLibraryUsageDescription</key>
  <string>Workforce OS requires photo access to attach medical reports and official documents.</string>
  ```

### 3.2 Android Release Build Defects (`android/app/build.gradle`)
* **Finding ID**: AND-001
* **Severity**: **HIGH**
* **Defect**: In `android/app/build.gradle:105-110`:
  ```groovy
  buildTypes {
      release {
          signingConfig = signingConfigs.debug // Signs release APK with debug keystore!
          // Missing: minifyEnabled true
          // Missing: shrinkResources true
      }
  }
  ```
* **Consequences**:
  1. **Signing**: Release artifacts are signed with the insecure development debug key.
  2. **Security**: No code shrinking (R8) or obfuscation, leaving bytecode exposed.
  3. **App Size**: The APK contains unused resource files, ballooning download size over mobile cellular networks.
* **Required Fix**: Create a dedicated release keystore and enable R8:
  ```groovy
  buildTypes {
      release {
          minifyEnabled true
          shrinkResources true
          proguardFiles getDefaultProguardFile('proguard-android.txt'), 'proguard-rules.pro'
      }
  }
  ```

---

## 4. Production Configuration & Readiness Matrix

| Production Gate | Status | Impact / Notes |
| :--- | :--- | :--- |
| **DATABASE_URL Enforcement** | **FAILED ON VERCEL** | Bypassed by `process.env.VERCEL` override; writes to transient `/tmp`. |
| **JWT_SECRET Persistence** | **PASS** | `jwtMachineSecret.json` persists secret locally across process restarts. |
| **K8s Liveness Probe** | **PASS** | `/health/live` returns 200 OK when event loop is responsive. |
| **K8s Readiness Probe** | **PASS** | `/health/ready` evaluates database and disk write access. |
| **Apple App Store Compliance** | **FAILED** | Missing 3 mandatory `NS*UsageDescription` privacy strings. |
| **Google Play Compliance** | **WARNING** | Signed with debug keystore; R8 obfuscation disabled. |
| **Backup Automation** | **PASS** | `backupService.js` creates SHA-256 verified snapshots. |

---

## 5. Deployment Recommendations

1. **Abandon Vercel or Require External PostgreSQL**: Do not deploy to Vercel without fully wiring `DATABASE_URL` to a persistent hosted PostgreSQL cluster (e.g. AWS RDS, Supabase, Neon).
2. **Standardize on Docker Containerization**: Deploy via container orchestrators (Docker Swarm, AWS ECS, or Kubernetes) utilizing persistent volume claims.
3. **Patch Mobile Manifests Immediately**: Update `ios/Runner/Info.plist` and `android/app/build.gradle` before generating mobile release bundles.
