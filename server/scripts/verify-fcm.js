#!/usr/bin/env node
/**
 * Firebase FCM Diagnostic & Verification CLI Tool
 * Verifies local Firebase credentials, Google OAuth2 token generation,
 * and FCM HTTP v1 dispatch capability.
 *
 * Usage:
 *   node scripts/verify-fcm.js
 *   node scripts/verify-fcm.js --token <DEVICE_FCM_TOKEN>
 */

const path = require('path');
const fs = require('fs');

const fcm = require('../src/fcm');
const { data } = require('../src/db');

async function run() {
  console.log('====================================================');
  console.log('  Elaraby Connect — Firebase FCM Diagnostics');
  console.log('====================================================\n');

  // 1. Mobile App Client Check
  const googleServicesPath = path.join(__dirname, '..', '..', 'android', 'app', 'google-services.json');
  const googleServicesExists = fs.existsSync(googleServicesPath);
  console.log(`[1] Android google-services.json:`);
  if (googleServicesExists) {
    try {
      const gs = JSON.parse(fs.readFileSync(googleServicesPath, 'utf8'));
      const projId = gs?.project_info?.project_id || 'unknown';
      const pkg = gs?.client?.[0]?.client_info?.android_client_info?.package_name || 'unknown';
      console.log(`    Status:        PRESENT`);
      console.log(`    Project ID:    ${projId}`);
      console.log(`    Package:       ${pkg}`);
    } catch (e) {
      console.log(`    Status:        ERROR parsing file: ${e.message}`);
    }
  } else {
    console.log(`    Status:        MISSING at ${googleServicesPath}`);
  }
  console.log();

  // 2. Server Service Account Check
  const keyPath = process.env.FCM_SERVICE_ACCOUNT_PATH || path.join(__dirname, '..', 'firebase-service-account.json');
  console.log(`[2] Server Firebase Service Account:`);
  console.log(`    Target Path:   ${keyPath}`);
  const configured = fcm.isConfigured();
  console.log(`    Configured:    ${configured ? 'YES (Active credentials detected)' : 'NO / PLACEHOLDER'}`);

  if (!configured) {
    console.log('\n[!NOTE] The server is currently in safe fallback mode.');
    console.log('        In-app inbox notifications will be saved to the database,');
    console.log('        but external mobile push notifications will be skipped until');
    console.log('        the real service account JSON is supplied.\n');
    console.log('To activate full FCM mobile push:');
    console.log('  1. Go to Firebase Console -> Project Settings -> Service accounts');
    console.log('  2. Click "Generate new private key"');
    console.log('  3. Save the downloaded JSON file as: server/firebase-service-account.json');
    console.log('     (or set FIREBASE_SERVICE_ACCOUNT_JSON in .env)\n');
    return;
  }

  // 3. OAuth2 Handshake Check
  console.log(`\n[3] Testing Google OAuth2 Token Generation...`);
  try {
    const token = await fcm.sendToToken('dummy_probe_token', 'Probe', 'Probe');
    console.log(`    OAuth2 & API Dispatch check initiated successfully.`);
  } catch (err) {
    console.log(`    OAuth2 Error: ${err.message}`);
  }

  // 4. Check registered FCM tokens in DB
  const db = data();
  const registeredCount = (db.fcmTokens || []).length;
  console.log(`\n[4] Database FCM Registered Devices:`);
  console.log(`    Total registered device tokens: ${registeredCount}`);
  if (registeredCount > 0) {
    db.fcmTokens.slice(0, 5).forEach((t, idx) => {
      console.log(`    #${idx + 1} Emp: ${t.employeeId} | Token: ${t.token.slice(0, 20)}...`);
    });
  }

  // Optional targeted push if --token argument provided
  const tokenArgIdx = process.argv.indexOf('--token');
  if (tokenArgIdx !== -1 && process.argv[tokenArgIdx + 1]) {
    const targetToken = process.argv[tokenArgIdx + 1];
    console.log(`\n[5] Dispatching test notification to token: ${targetToken.slice(0, 25)}...`);
    const sent = await fcm.sendToToken(
      targetToken,
      'Elaraby Connect Test',
      'This is a verified test push notification from Elaraby Connect backend.'
    );
    console.log(`    Result: ${sent ? 'SUCCESS (Delivered to FCM gateway)' : 'FAILED'}`);
  }

  console.log('\n====================================================');
  console.log('  Diagnostic Complete');
  console.log('====================================================\n');
}

run().catch((e) => {
  console.error('Fatal diagnostic error:', e);
  process.exit(1);
});
