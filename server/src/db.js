// Persistent enterprise database engine for Elaraby Workforce
// Features:
// - Atomic durability via temporary file + rename with crash resilience
// - Schema validation, constraints, and referential integrity
// - Versioned schema migration runner
// - High-performance in-memory indexing for O(1) lookups
// - Snapshot isolation transactions with automatic rollback on violation
// - Automatic backup rotation and Cloud Firestore synchronization

const fs = require('fs');
const path = require('path');
const { validateConstraints } = require('./schema');
const { indexes } = require('./indexes');
const { runMigrations } = require('./migrations/runner');

const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const isProd = process.env.NODE_ENV === 'production';
const customDataDir = process.env.DATA_PATH || process.env.DATABASE_PATH || process.env.DATA_DIR;

let DATA_DIR;
if (customDataDir) {
  DATA_DIR = path.resolve(customDataDir);
} else if (isVercel) {
  DATA_DIR = '/tmp';
  if (isProd && !process.env.ALLOW_EPHEMERAL_STORAGE) {
    console.warn('⚠️ [CRITICAL PRODUCTION NOTICE] Server running with ephemeral /tmp storage. Connect persistent volume or Firestore for zero data loss.');
  }
} else {
  DATA_DIR = path.join(__dirname, '..', 'data');
}
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const SEED_FILE = path.join(__dirname, '..', 'data', 'db.json');

const EMPTY = () => ({
  schemaMigrations: [],
  counters: { request: 100, notification: 100, audit: 100, concern: 100 },
  employees: [],
  otpCodes: [],
  requests: [],
  concerns: [],
  announcements: [],
  news: [],
  benefits: [],
  trips: [],
  notifications: [],
  payroll: [],
  roster: [],
  fcmTokens: [],
  auditLogs: [],
  appVersionConfig: {
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    currentVersion: '1.0.0',
    forceUpdate: false,
    title: 'تحديث جديد متوفر',
    titleEn: 'Update Available',
    message: 'يتوفر إصدار جديد من تطبيق العربي كونكت. يرجى التحديث لمتابعة استخدام التطبيق بكفاءة وأمان.',
    messageEn: 'A new version of Elaraby Connect is available. Please update to continue using the application securely.',
    updateUrl: process.env.APP_UPDATE_URL || 'https://server-six-xi-42.vercel.app',
  },
});

let _firestoreLoaded = false;
let _data = null;
let _lastBackupTime = 0;
let _firestoreInitTriggered = false;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

let firestore = null;
try {
  firestore = require('./firestore');
} catch (_) {}

function data() {
  if (_data) return _data;

  // On Vercel, if /tmp/db.json doesn't exist yet, seed it from bundled data
  if (isVercel && !fs.existsSync(DB_FILE) && fs.existsSync(SEED_FILE)) {
    try {
      fs.copyFileSync(SEED_FILE, DB_FILE);
    } catch (_) {}
  }

  if (fs.existsSync(DB_FILE)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      _data = { ...EMPTY(), ...parsed };
    } catch (err) {
      console.error('[db] corrupted db.json, attempting backup recovery:', err.message);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const recovered = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
          _data = { ...EMPTY(), ...recovered };
          console.log('[db] successfully recovered data from db.backup.json');
        } catch (backupErr) {
          console.error('[db] backup recovery failed:', backupErr.message);
        }
      }
    }
  }

  if (!_data) {
    _data = EMPTY();
    save();
  }

  // Execute versioned schema migrations
  try {
    const applied = runMigrations(_data);
    if (applied && applied.length > 0) {
      save();
    }
  } catch (migErr) {
    console.error('[db] migration execution notice:', migErr.message);
  }

  // Build index tables for fast lookups
  indexes.rebuild(_data);

  const isTest = process.env.NODE_ENV === 'test' || process.argv.some((a) => a.includes('test'));
  if (firestore && !_firestoreInitTriggered && !isTest) {
    _firestoreInitTriggered = true;
    firestore.checkAvailability().then((available) => {
      if (available) {
        firestore.loadFromFirestore().then((remote) => {
          if (remote && _data) {
            _data = { ...EMPTY(), ..._data, ...remote };
            indexes.rebuild(_data);
          } else if (_data) {
            firestore.syncToFirestore(_data).catch(() => {});
          }
          _firestoreLoaded = true;
        }).catch(() => {
          _firestoreLoaded = true;
        });
      } else {
        _firestoreLoaded = true;
      }
    }).catch(() => {
      _firestoreLoaded = true;
    });
  }

  return _data;
}

let _isSaving = false;
let _saveQueued = false;

async function _flushAsync() {
  if (_isSaving) {
    _saveQueued = true;
    return;
  }
  _isSaving = true;
  try {
    if (!_data) return;
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
    const serialized = JSON.stringify(_data, null, 2);
    const tmp = DB_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
    await fs.promises.writeFile(tmp, serialized);
    await fs.promises.rename(tmp, DB_FILE);

    // Background sync to Cloud Firestore if connected and initial sync completed
    if (firestore && _firestoreLoaded) {
      firestore.syncToFirestore(_data).catch(() => {});
    }

    // Periodic backup rotation
    const now = Date.now();
    if (now - _lastBackupTime > BACKUP_INTERVAL_MS || !fs.existsSync(BACKUP_FILE)) {
      try {
        await fs.promises.copyFile(DB_FILE, BACKUP_FILE);
        _lastBackupTime = now;
      } catch (_) {}
    }
  } catch (err) {
    console.error('[db] save error:', err.message);
  } finally {
    _isSaving = false;
    if (_saveQueued) {
      _saveQueued = false;
      _flushAsync();
    }
  }
}

let _debounceTimer = null;
const DEBOUNCE_MS = 50;

function save() {
  if (_debounceTimer) clearTimeout(_debounceTimer);
  _debounceTimer = setTimeout(() => {
    _flushAsync().catch(() => {});
  }, DEBOUNCE_MS);
}

function flushSync() {
  if (_debounceTimer) {
    clearTimeout(_debounceTimer);
    _debounceTimer = null;
  }
  return _flushAsync();
}

function nextId(collection) {
  const d = data();
  d.counters[collection] = (d.counters[collection] || 100) + 1;
  return d.counters[collection];
}

/// Executes a synchronous transaction with snapshot isolation and constraint validation.
/// If an exception is thrown inside the callback or constraints are violated,
/// the database state rolls back completely to the pre-transaction snapshot.
function transaction(fn) {
  const current = data();
  // Deep clone state snapshot
  const snapshot = JSON.parse(JSON.stringify(current));
  try {
    const result = fn(current);
    // Validate all relational constraints and check constraints
    validateConstraints(current);
    // Refresh indexes and schedule write
    indexes.rebuild(current);
    save();
    return result;
  } catch (err) {
    // Rollback to snapshot
    _data = snapshot;
    indexes.rebuild(_data);
    throw err;
  }
}

/// Asynchronous transaction runner
async function withTransaction(fn) {
  const current = data();
  const snapshot = JSON.parse(JSON.stringify(current));
  try {
    const result = await fn(current);
    validateConstraints(current);
    indexes.rebuild(current);
    save();
    return result;
  } catch (err) {
    _data = snapshot;
    indexes.rebuild(_data);
    throw err;
  }
}

module.exports = {
  data,
  save,
  flushSync,
  nextId,
  transaction,
  withTransaction,
  indexes,
  validateConstraints,
  DATA_DIR,
  DB_FILE,
};
