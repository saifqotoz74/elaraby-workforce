# Mobile Production Release Checklist & Platform Hardening (Phase 13)

**Application:** Elaraby Connect (Android & iOS)  
**Package / Application ID:** `com.elaraby.workforce.elaraby_workforce`  
**Bundle Identifier (iOS):** `com.elaraby.workforce.elarabyWorkforce`  
**Target Environment:** Google Play Console & Apple App Store  
**Audit Date:** September 12, 2026  

---

## 1. Production Artifact Readiness Matrix

| Platform | Production Artifact | Status | Details / Actions Required |
| :--- | :--- | :---: | :--- |
| **Android** | `google-services.json` | **PRESENT** | Configured for package `com.elaraby.workforce.elaraby_workforce` under project `elaraby-workforce-222d2`. |
| **Android** | Production Keystore (`.jks`) | **WAITING** | Keystore must NOT be stored in git. Must be injected via CI/CD Secret `ANDROID_KEYSTORE_BASE64` during release build. |
| **Android** | ProGuard / R8 Obfuscation | **VERIFIED** | Enforces code shrinking, obfuscation, and optimization in `android/app/build.gradle`. |
| **Android** | Network Security Config | **VERIFIED** | Cleartext HTTP strictly blocked in release mode (`android:usesCleartextTraffic="false"`). |
| **iOS** | `GoogleService-Info.plist` | **WAITING** | Needs to be generated from Firebase Console for iOS bundle ID and placed in `ios/Runner/`. |
| **iOS** | Apple Distribution Certificate | **WAITING** | Managed via fastlane match or Apple Developer Portal (stored in CI/CD secrets). |
| **iOS** | APNs Authentication Key (.p8) | **WAITING** | Required for Firebase Cloud Messaging APNs transport. |
| **iOS** | Export Compliance & Privacy | **VERIFIED** | `PrivacyInfo.xcprivacy` and `ITSAppUsesNonExemptEncryption=false` configured in `ios/Runner/Info.plist`. |

---

## 2. Release Build Commands

### Android Release Bundle (AAB):
```bash
# Verify analysis and tests first
flutter analyze
flutter test

# Build App Bundle for Google Play Console release
flutter build appbundle --release --obfuscate --split-debug-info=build/app/outputs/symbols
```

### iOS Release Archive (IPA):
```bash
# Build iOS release archive
flutter build ipa --release --obfuscate --split-debug-info=build/ios/outputs/symbols
```

---

## 3. Human Approval Gate Checklist (Prior to Store Submission)
The following actions require human approval and credentials from the Elaraby Group Enterprise IT Administrator:
- [ ] Sign release `.aab` with official Elaraby Google Play upload key.
- [ ] Provide production Apple Developer Team ID and provisioning profiles.
- [ ] Download and verify production `GoogleService-Info.plist` for iOS FCM push notifications.
- [ ] Review Google Play Data Safety form (National ID, Location for attendance, Notifications).
- [ ] Review Apple App Store Privacy Disclosures.
