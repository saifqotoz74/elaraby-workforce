const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let _firestore = null;
let _isAvailable = false;
let _checked = false;

function getFirestoreInstance() {
  if (_checked) return _firestore;
  _checked = true;

  try {
    let key = null;
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      key = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    } else {
      const keyPath = path.join(__dirname, '..', 'firebase-service-account.json');
      if (fs.existsSync(keyPath)) {
        try {
          key = require('../firebase-service-account.json');
        } catch (_) {
          key = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
        }
      }
    }

    if (!key || !key.client_email || !key.private_key) {
      return null;
    }

    const app = getApps().length > 0 ? getApps()[0] : initializeApp({ credential: cert(key) });
    _firestore = getFirestore(app);
    return _firestore;
  } catch (err) {
    console.warn('[firestore] init notice:', err.message);
    return null;
  }
}

async function checkAvailability() {
  const db = getFirestoreInstance();
  if (!db) return false;
  try {
    await db.collection('_health').doc('check').get();
    _isAvailable = true;
    console.log('[firestore] Connected to Cloud Firestore successfully.');
    return true;
  } catch (err) {
    if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
      console.log('[firestore] Cloud Firestore database is not yet created in Firebase Console.');
    } else {
      console.warn('[firestore] availability check notice:', err.message);
    }
    _isAvailable = false;
    return false;
  }
}

async function syncToFirestore(allData) {
  const db = getFirestoreInstance();
  if (!db) return;
  if (!_isAvailable) {
    const ok = await checkAvailability();
    if (!ok) return;
  }
  try {
    const docRef = db.collection('app_state').doc('current');
    await docRef.set(allData, { merge: true });
    console.log('[firestore] State synced to Cloud Firestore.');
  } catch (err) {
    console.warn('[firestore] sync error:', err.message);
  }
}

async function loadFromFirestore() {
  const db = getFirestoreInstance();
  if (!db) return null;
  if (!_isAvailable) {
    const ok = await checkAvailability();
    if (!ok) return null;
  }
  try {
    const doc = await db.collection('app_state').doc('current').get();
    if (doc.exists) {
      console.log('[firestore] Remote state loaded from Cloud Firestore.');
      return doc.data();
    }
  } catch (err) {
    console.warn('[firestore] load error:', err.message);
  }
  return null;
}

module.exports = {
  getFirestoreInstance,
  checkAvailability,
  syncToFirestore,
  loadFromFirestore,
  isAvailable: () => _isAvailable,
};
