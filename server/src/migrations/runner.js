// Migration Runner: Orchestrates and tracks versioned schema migrations
const fs = require('fs');
const path = require('path');

const DEFINITIONS_DIR = path.join(__dirname, 'definitions');

function getAvailableMigrations() {
  if (!fs.existsSync(DEFINITIONS_DIR)) return [];
  const files = fs.readdirSync(DEFINITIONS_DIR)
    .filter((f) => f.endsWith('.js'))
    .sort();

  return files.map((file) => {
    const mod = require(path.join(DEFINITIONS_DIR, file));
    return {
      version: mod.version,
      name: mod.name || file.replace(/\.js$/, ''),
      up: mod.up,
    };
  }).sort((a, b) => a.version - b.version);
}

function runMigrations(dbState) {
  if (!dbState) return [];

  if (!Array.isArray(dbState.schemaMigrations)) {
    dbState.schemaMigrations = [];
  }

  const appliedVersions = new Set(dbState.schemaMigrations.map((m) => m.version));
  const available = getAvailableMigrations();
  const newlyApplied = [];

  for (const migration of available) {
    if (!appliedVersions.has(migration.version)) {
      try {
        console.log(`[migration] Applying migration ${migration.version}: ${migration.name}...`);
        migration.up(dbState);
        dbState.schemaMigrations.push({
          version: migration.version,
          name: migration.name,
          appliedAt: Date.now(),
        });
        newlyApplied.push(migration.name);
        console.log(`✔ [migration] ${migration.name} applied successfully.`);
      } catch (err) {
        console.error(`❌ [migration] Failed to apply ${migration.name}:`, err.message);
        throw err;
      }
    }
  }

  return newlyApplied;
}

module.exports = {
  getAvailableMigrations,
  runMigrations,
};
