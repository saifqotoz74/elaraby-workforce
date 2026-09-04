// JSON-file backed enterprise data store.
// Features: atomic write via temp file + rename, auto-backup rotation,
// schema defaults, audit logging support, and Vercel serverless /tmp compatibility.
const fs = require('fs');
const path = require('path');

const isVercel = !!(process.env.VERCEL || process.env.NOW_REGION);
const DATA_DIR = isVercel ? '/tmp' : path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');
const SEED_FILE = path.join(__dirname, '..', 'data', 'db.json');

const EMPTY = () => ({
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
  appVersionConfig: {
    minVersion: '1.0.0',
    latestVersion: '1.0.0',
    currentVersion: '1.0.0',
    forceUpdate: false,
    title: 'تحديث جديد متوفر',
    titleEn: 'Update Available',
    message: 'يتوفر إصدار جديد من تطبيق العربي كونكت. يرجى التحديث لمتابعة استخدام التطبيق بكفاءة وأمان.',
    messageEn: 'A new version of Elaraby Connect is available. Please update to continue using the application securely.',
    updateUrl: 'https://server-six-xi-42.vercel.app',
  },
});

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
      return _data;
    } catch (err) {
      console.error('[db] corrupted db.json, attempting backup recovery:', err.message);
      if (fs.existsSync(BACKUP_FILE)) {
        try {
          const recovered = JSON.parse(fs.readFileSync(BACKUP_FILE, 'utf8'));
          _data = { ...EMPTY(), ...recovered };
          console.log('[db] successfully recovered data from db.backup.json');
          return _data;
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
  if (firestore && !_firestoreInitTriggered) {
    _firestoreInitTriggered = true;
    firestore.checkAvailability().then((available) => {
      if (available) {
        firestore.loadFromFirestore().then((remote) => {
          if (remote && _data) {
            _data = { ...EMPTY(), ..._data, ...remote };
          } else if (_data) {
            firestore.syncToFirestore(_data).catch(() => {});
          }
        }).catch(() => {});
      }
    }).catch(() => {});
  }

  return _data;
}

function save() {
  if (!_data) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const serialized = JSON.stringify(_data, null, 2);
  const tmp = DB_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
  
  fs.writeFileSync(tmp, serialized);
  fs.renameSync(tmp, DB_FILE);

  // Background sync to Cloud Firestore if connected
  if (firestore) {
    firestore.syncToFirestore(_data).catch(() => {});
  }

  // Periodic backup rotation
  const now = Date.now();
  if (now - _lastBackupTime > BACKUP_INTERVAL_MS || !fs.existsSync(BACKUP_FILE)) {
    try {
      fs.copyFileSync(DB_FILE, BACKUP_FILE);
      _lastBackupTime = now;
    } catch (_) {}
  }
}

function nextId(collection) {
  const d = data();
  d.counters[collection] = (d.counters[collection] || 100) + 1;
  return d.counters[collection];
}

module.exports = { data, save, nextId };
