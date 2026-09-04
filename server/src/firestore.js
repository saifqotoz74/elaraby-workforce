// Cloud Firestore Enterprise Multi-Collection Engine
// Splits state across individual collections to eliminate the 1MB document limit
// and provide true database scalability for 100,000+ records.
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const path = require('path');
const fs = require('fs');

let _firestore = null;
let _isAvailable = false;
let _checked = false;

const COLLECTIONS = [
  'employees',
  'requests',
  'announcements',
  'news',
  'benefits',
  'trips',
  'notifications',
  'payroll',
  'roster',
  'fcmTokens',
  'auditLogs',
];

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
    await db.collection('_health').doc('check').set({ timestamp: Date.now() });
    _isAvailable = true;
    return true;
  } catch (err) {
    if (err.code === 5 || err.message?.includes('NOT_FOUND')) {
      console.log('[firestore] Cloud Firestore database is not yet created in Firebase Console.');
    } else {
      console.warn('[firestore] availability notice:', err.message);
    }
    _isAvailable = false;
    return false;
  }
}

/// Commits an array of write operations using batched writes (max 400 per batch).
async function commitBatches(db, operations) {
  const BATCH_SIZE = 400;
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    for (const op of chunk) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data, { merge: true });
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/// Syncs all collections as independent documents into Cloud Firestore.
async function syncToFirestore(allData) {
  const db = getFirestoreInstance();
  if (!db) return;
  if (!_isAvailable) {
    const ok = await checkAvailability();
    if (!ok) return;
  }

  try {
    const operations = [];

    // 1. Sync metadata / counters
    if (allData.counters) {
      operations.push({
        type: 'set',
        ref: db.collection('metadata').doc('counters'),
        data: allData.counters,
      });
    }

    // 2. Sync individual collections
    for (const colName of COLLECTIONS) {
      const items = allData[colName];
      if (Array.isArray(items)) {
        for (let i = 0; i < items.length; i++) {
          const item = items[i];
          const docId = String(
            item.id ||
            item.employeeId ||
            (item.token ? Buffer.from(item.token).toString('hex').slice(0, 20) : `item_${i}`)
          );
          operations.push({
            type: 'set',
            ref: db.collection(colName).doc(docId),
            data: item,
          });
        }
      }
    }

    // 3. Keep backward-compatible pointer
    operations.push({
      type: 'set',
      ref: db.collection('app_state').doc('summary'),
      data: {
        lastSynced: Date.now(),
        employeeCount: allData.employees?.length || 0,
        requestCount: allData.requests?.length || 0,
        announcementCount: allData.announcements?.length || 0,
      },
    });

    await commitBatches(db, operations);
    console.log('[firestore] Enterprise multi-collection sync completed successfully.');
  } catch (err) {
    console.warn('[firestore] multi-collection sync error:', err.message);
  }
}

/// Loads state from individual Firestore collections.
async function loadFromFirestore() {
  const db = getFirestoreInstance();
  if (!db) return null;
  if (!_isAvailable) {
    const ok = await checkAvailability();
    if (!ok) return null;
  }

  try {
    const result = {
      counters: { request: 100, notification: 100, audit: 100 },
      employees: [],
      otpCodes: [],
      requests: [],
      announcements: [],
      news: [],
      benefits: [],
      trips: [],
      notifications: [],
      payroll: [],
      roster: [],
      fcmTokens: [],
      auditLogs: [],
    };

    // Load counters
    const countersDoc = await db.collection('metadata').doc('counters').get();
    if (countersDoc.exists) {
      result.counters = { ...result.counters, ...countersDoc.data() };
    }

    // Load all collections concurrently
    let totalDocs = 0;
    await Promise.all(
      COLLECTIONS.map(async (colName) => {
        const snap = await db.collection(colName).get();
        if (!snap.empty) {
          result[colName] = snap.docs.map((doc) => doc.data());
          totalDocs += result[colName].length;
        }
      })
    );

    // If Firestore has data, return it
    if (totalDocs > 0) {
      console.log(`[firestore] Loaded ${totalDocs} documents across collections from Cloud Firestore.`);
      return result;
    }

    // Fallback: check legacy single document if collections were empty
    const legacyDoc = await db.collection('app_state').doc('current').get();
    if (legacyDoc.exists) {
      const legacyData = legacyDoc.data();
      console.log('[firestore] Migrating legacy document to multi-collection layout...');
      await syncToFirestore(legacyData);
      return legacyData;
    }
  } catch (err) {
    console.warn('[firestore] multi-collection load error:', err.message);
  }
  return null;
}

/// Writes or merges a single document directly to its collection in Firestore.
async function saveDocument(collectionName, docId, data) {
  const db = getFirestoreInstance();
  if (!db || !_isAvailable) return;
  try {
    await db.collection(collectionName).doc(String(docId)).set(data, { merge: true });
  } catch (err) {
    console.warn(`[firestore] write error for ${collectionName}/${docId}:`, err.message);
  }
}

/// Deletes a single document directly from its collection in Firestore.
async function deleteDocument(collectionName, docId) {
  const db = getFirestoreInstance();
  if (!db || !_isAvailable) return;
  try {
    await db.collection(collectionName).doc(String(docId)).delete();
  } catch (err) {
    console.warn(`[firestore] delete error for ${collectionName}/${docId}:`, err.message);
  }
}

module.exports = {
  getFirestoreInstance,
  checkAvailability,
  syncToFirestore,
  loadFromFirestore,
  saveDocument,
  deleteDocument,
  isAvailable: () => _isAvailable,
};
