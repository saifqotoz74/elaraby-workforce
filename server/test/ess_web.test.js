const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

test('Test 1: index.html exists and contains Arabic RTL declaration and Cairo font', () => {
  const htmlPath = path.join(__dirname, '../ess/index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.match(content, /lang="ar"/);
  assert.match(content, /dir="rtl"/);
  assert.match(content, /Cairo/);
});

test('Test 2: ess.css exists and defines color tokens and responsive grid', () => {
  const cssPath = path.join(__dirname, '../ess/ess.css');
  const content = fs.readFileSync(cssPath, 'utf8');
  assert.match(content, /--primary:/);
  assert.match(content, /--bg:/);
  assert.match(content, /grid-template-columns:/);
});

test('Test 3: ess.js exists and contains auth and tab switching logic', () => {
  const jsPath = path.join(__dirname, '../ess/ess.js');
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.match(content, /loginBtn/);
  assert.match(content, /tabBtns\.forEach/);
});

test('Test 4: Verify HTML contains payslip, leaves, and shift schedule view sections', () => {
  const htmlPath = path.join(__dirname, '../ess/index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.match(content, /id="tab-salary"/);
  assert.match(content, /id="tab-leaves"/);
  assert.match(content, /id="tab-shifts"/);
});

test('Test 5: AUTH-002: Verify ess.js connects login to /api/auth/pin/verify backend endpoint', () => {
  const jsPath = path.join(__dirname, '../ess/ess.js');
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.match(content, /\/api\/auth\/pin\/verify/);
  assert.match(content, /fetch\(/);
  assert.match(content, /method:\s*['"]POST['"]/);
});

test('Test 6: AUTH-002: Verify ess.js handles errors and rejects unauthenticated dashboard bypass', () => {
  const jsPath = path.join(__dirname, '../ess/ess.js');
  const content = fs.readFileSync(jsPath, 'utf8');
  assert.match(content, /showError/);
  assert.match(content, /res\.ok/);
  assert.match(content, /login-error/);
});

test('Test 7: AUTH-002: Verify index.html contains login-error alert container', () => {
  const htmlPath = path.join(__dirname, '../ess/index.html');
  const content = fs.readFileSync(htmlPath, 'utf8');
  assert.match(content, /id="login-error"/);
});
