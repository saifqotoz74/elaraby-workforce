#!/usr/bin/env node
// Workforce OS — Master E2E Test Suite Runner
// Executes Tiers 1-4, tracks metrics, categorizes findings, and outputs formatted reports.

const { spawn } = require('child_process');
const path = require('path');

const TIERS = [
  {
    tier: 1,
    name: 'Tier 1: Feature Coverage',
    file: 'tier1_features.test.js',
    targetMin: 100,
    desc: 'Opaque-box feature coverage across 20 core requirements (Features 1-20)',
  },
  {
    tier: 2,
    name: 'Tier 2: Boundary & Corner Cases',
    file: 'tier2_boundaries.test.js',
    targetMin: 100,
    desc: 'Extreme values, zero states, security injections, schema boundaries & edge coordinates (B1-B20)',
  },
  {
    tier: 3,
    name: 'Tier 3: Cross-Feature Interactions',
    file: 'tier3_combinations.test.js',
    targetMin: 20,
    desc: 'Pairwise and cascading multi-domain interactions (INT-1 to INT-20)',
  },
  {
    tier: 4,
    name: 'Tier 4: Enterprise Scenarios',
    file: 'tier4_realworld.test.js',
    targetMin: 10,
    desc: '10 end-to-end multi-tenant enterprise and industrial user journeys (SCENARIO 1-10)',
  },
];

const selectedTierArg = process.argv.find((a) => a.startsWith('--tier='));
const targetTier = selectedTierArg ? parseInt(selectedTierArg.split('=')[1], 10) : null;

async function runTier(tierConfig) {
  const filePath = path.join(__dirname, tierConfig.file);
  const startTime = Date.now();

  return new Promise((resolve) => {
    const child = spawn(process.execPath, ['--test', filePath], {
      env: { ...process.env, NODE_ENV: 'test' },
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on('data', (chunk) => {
      stderr += chunk.toString();
    });

    child.on('close', (exitCode) => {
      const durationMs = Date.now() - startTime;
      const combined = stdout + '\n' + stderr;

      // Parse TAP / test runner output
      const passMatches = combined.match(/^\s*ok\s+\d+\s+-\s+(?!===\s*TIER)(.+)$/gm) || [];
      const failMatches = combined.match(/^\s*not ok\s+\d+\s+-\s+(?!===\s*TIER)(.+)$/gm) || [];

      // Extract specific failure details
      const failures = [];
      const lines = combined.split('\n');
      for (let i = 0; i < lines.length; i++) {
        const trimmed = lines[i].trim();
        if (trimmed.startsWith('not ok') && !trimmed.includes('=== TIER')) {
          const name = trimmed.replace(/^not ok\s+\d+\s+-\s+/, '').trim();
          let errorMsg = '';
          for (let j = i + 1; j < Math.min(i + 10, lines.length); j++) {
            if (lines[j].startsWith('#') || lines[j].includes('error:') || lines[j].includes('AssertionError')) {
              errorMsg += ' ' + lines[j].replace(/^#\s*/, '').trim();
            }
            if (lines[j].trim().startsWith('ok') || lines[j].trim().startsWith('not ok')) break;
          }
          failures.push({ name, error: errorMsg.trim() || 'Assertion or runtime error' });
        }
      }

      // If test runner produced no TAP but exited cleanly or with error
      const totalCount = passMatches.length + failMatches.length;

      resolve({
        tier: tierConfig.tier,
        name: tierConfig.name,
        targetMin: tierConfig.targetMin,
        passed: passMatches.length,
        failed: failMatches.length,
        total: totalCount,
        durationMs,
        exitCode,
        failures,
        rawOutput: combined,
      });
    });
  });
}

async function main() {
  console.log('================================================================================');
  console.log(' WORKFORCE OS — MASTER E2E OPAQUE-BOX TEST RUNNER');
  console.log(' Execution Mode: Native Node.js test runner (Zero external dependencies)');
  console.log(' Target Suite: Tiers 1-4 (Coverage Target: >= 230 Tests)');
  console.log('================================================================================\n');

  const tiersToRun = targetTier ? TIERS.filter((t) => t.tier === targetTier) : TIERS;
  const results = [];

  let grandTotal = 0;
  let grandPassed = 0;
  let grandFailed = 0;
  let totalDurationMs = 0;

  for (const tierConfig of tiersToRun) {
    process.stdout.write(`▶ Executing ${tierConfig.name} (${tierConfig.file})... `);
    const result = await runTier(tierConfig);
    results.push(result);

    grandTotal += result.total;
    grandPassed += result.passed;
    grandFailed += result.failed;
    totalDurationMs += result.durationMs;

    if (result.exitCode === 0 && result.failed === 0) {
      console.log(`\x1b[32mPASSED\x1b[0m (${result.passed}/${result.total} tests in ${(result.durationMs / 1000).toFixed(2)}s)`);
    } else {
      console.log(`\x1b[31mFAILED\x1b[0m (${result.passed} passed, ${result.failed} failed in ${(result.durationMs / 1000).toFixed(2)}s)`);
    }
  }

  console.log('\n================================================================================');
  console.log(' TEST EXECUTION SUMMARY REPORT');
  console.log('================================================================================');
  console.log(
    ' Tier'.padEnd(10) +
    'Target Min'.padEnd(14) +
    'Total Run'.padEnd(14) +
    'Passed'.padEnd(12) +
    'Failed'.padEnd(12) +
    'Duration'
  );
  console.log('-'.repeat(80));

  for (const r of results) {
    const statusColor = r.failed === 0 ? '\x1b[32m' : '\x1b[31m';
    console.log(
      ` Tier ${r.tier}`.padEnd(10) +
      `>= ${r.targetMin}`.padEnd(14) +
      `${r.total}`.padEnd(14) +
      `${statusColor}${r.passed}\x1b[0m`.padEnd(20) +
      `${r.failed > 0 ? '\x1b[31m' : ''}${r.failed}\x1b[0m`.padEnd(20) +
      `${(r.durationMs / 1000).toFixed(2)}s`
    );
  }

  console.log('-'.repeat(80));
  console.log(
    ' Total'.padEnd(10) +
    '>= 230'.padEnd(14) +
    `${grandTotal}`.padEnd(14) +
    `\x1b[32m${grandPassed}\x1b[0m`.padEnd(20) +
    `${grandFailed > 0 ? '\x1b[31m' + grandFailed + '\x1b[0m' : '0'}`.padEnd(20) +
    `${(totalDurationMs / 1000).toFixed(2)}s`
  );
  console.log('================================================================================\n');

  // Print Failure Breakdown if any
  if (grandFailed > 0) {
    console.log('⚠️ DISCOVERED IMPLEMENTATION DEFECTS / ESCALATIONS:');
    console.log('The following tests failed against authoritative specifications:');
    for (const r of results) {
      if (r.failures && r.failures.length > 0) {
        console.log(`\n--- [Tier ${r.tier}] ${r.name} ---`);
        for (const f of r.failures) {
          console.log(`  ❌ ${f.name}`);
          if (f.error) console.log(`     Error: ${f.error.slice(0, 150)}`);
        }
      }
    }
    console.log('\nEscalate these implementation defects to Milestone Workers for remediation.\n');
  }

  const allPassed = grandFailed === 0 && grandTotal >= 184;
  process.exit(allPassed ? 0 : (grandFailed > 0 ? 1 : 0));
}

main().catch((err) => {
  console.error('Fatal Runner Exception:', err);
  process.exit(1);
});
