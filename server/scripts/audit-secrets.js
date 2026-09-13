// Automated Enterprise Secret Scanner
const fs = require('fs');
const path = require('path');

const PROHIBITED_PATTERNS = [
  { name: 'Private Key Header', regex: /-----BEGIN (RSA |EC )?PRIVATE KEY-----/ },
  { name: 'Twilio Auth Token', regex: /(TWILIO_AUTH_TOKEN|twilio_token)\s*[:=]\s*['"][a-f0-9]{32}['"]/i },
  { name: 'Hardcoded Admin Backdoor Bypass', regex: /(isMatch|authenticated|isValid)\s*=\s*.*['"](admin123|elaraby2026)['"]/i },
  { name: 'Hardcoded Password Assignment', regex: /(const|let|var)\s*(adminPass|password)\s*=\s*['"](admin123|elaraby2026)['"]/i },
  { name: 'Database Password in Connection String', regex: /postgres:\/\/[^:]+:[^@]+@/i },
];

function scanDirectory(dir, issues = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', '.dart_tool', 'build', '.vercel'].includes(entry.name)) {
        scanDirectory(fullPath, issues);
      }
    } else if (entry.isFile()) {
      if (entry.name.endsWith('.example') || entry.name.includes('.test.') || entry.name.endsWith('.lock')) {
        continue;
      }
      if (entry.name.endsWith('.js') || entry.name.endsWith('.dart') || entry.name.endsWith('.json') || entry.name.endsWith('.yml')) {
        // Skip service account file that is explicitly gitignored
        if (entry.name === 'firebase-service-account.json') continue;
        const content = fs.readFileSync(fullPath, 'utf8');
        for (const rule of PROHIBITED_PATTERNS) {
          if (rule.regex.test(content)) {
            issues.push({
              file: fullPath,
              rule: rule.name,
            });
          }
        }
      }
    }
  }
  return issues;
}

function runAudit() {
  console.log('--- Scanning Codebase for Hardcoded Secrets ---');
  const rootDir = path.join(__dirname, '..', '..');
  const issues = [];
  scanDirectory(path.join(rootDir, 'server', 'src'), issues);
  scanDirectory(path.join(rootDir, 'lib'), issues);

  if (issues.length === 0) {
    console.log('✔ Secret scan passed: ZERO hardcoded production secrets found in code.');
    return true;
  } else {
    console.error(`❌ Secret scan failed: Found ${issues.length} potential secrets:`);
    issues.forEach((iss) => console.error(`  - [${iss.rule}] ${iss.file}`));
    return false;
  }
}

if (require.main === module) {
  const ok = runAudit();
  process.exit(ok ? 0 : 1);
}

module.exports = { runAudit };
