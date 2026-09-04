// JSON-file backed enterprise data store.
// Features: atomic write via temp file + rename, auto-backup rotation,
// schema defaults, and audit logging support.
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const BACKUP_FILE = path.join(DATA_DIR, 'db.backup.json');

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
});

let _data = null;
let _lastBackupTime = 0;
const BACKUP_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

function data() {
  if (_data) return _data;
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
  _data = EMPTY();
  save();
  return _data;
}

function save() {
  if (!_data) return;
  fs.mkdirSync(DATA_DIR, { recursive: true });
  const serialized = JSON.stringify(_data, null, 2);
  const tmp = DB_FILE + '.' + process.pid + '.' + Date.now() + '.tmp';
  
  fs.writeFileSync(tmp, serialized);
  fs.renameSync(tmp, DB_FILE);

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
