// Phase 3 Frontend Modules & Asset Integrity Test Suite
// Verifies complete Native ES Module frontend structure, file existence, and static delivery.

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function runPhase3Tests() {
  console.log('--- Starting Phase 3: Frontend Modules & Asset Integrity Tests ---');
  let passed = 0;
  let failed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ ${name}`);
      console.error(`    ${err.message}`);
      failed++;
    }
  }

  const adminDir = path.resolve(__dirname, '../admin');

  // 1. Check index.html semantic structure
  await test('index.html contains modern semantic structure and module scripts', async () => {
    const indexPath = path.join(adminDir, 'index.html');
    assert.ok(fs.existsSync(indexPath), 'index.html must exist');
    const content = fs.readFileSync(indexPath, 'utf8');

    assert.ok(content.includes('<div id="app">'), 'Must contain #app container');
    assert.ok(content.includes('css/design-system.css'), 'Must link design-system.css');
    assert.ok(content.includes('css/components.css'), 'Must link components.css');
    assert.ok(content.includes('css/views.css'), 'Must link views.css');
    assert.ok(content.includes('<script type="module" src="js/app.js"></script>'), 'Must load js/app.js as ES module');
    assert.ok(!content.includes('localStorage.getItem("adminToken")'), 'Old localStorage token references must be gone');
  });

  // 2. Check CSS stylesheets
  await test('All 3 CSS stylesheets exist and have valid rule declarations', async () => {
    const cssFiles = ['design-system.css', 'components.css', 'views.css'];
    for (const f of cssFiles) {
      const p = path.join(adminDir, 'css', f);
      assert.ok(fs.existsSync(p), `css/${f} must exist`);
      const css = fs.readFileSync(p, 'utf8');
      assert.ok(css.length > 500, `css/${f} must not be empty`);
    }
  });

  // 3. Check reusable components
  await test('All 9 core frontend UI components exist', async () => {
    const components = [
      'AppShell.js',
      'ConfirmDialog.js',
      'DataTable.js',
      'Modal.js',
      'Pagination.js',
      'Sidebar.js',
      'StatusBadge.js',
      'Toast.js',
      'Topbar.js',
    ];

    for (const comp of components) {
      const p = path.join(adminDir, 'js/components', comp);
      assert.ok(fs.existsSync(p), `components/${comp} must exist`);
      const src = fs.readFileSync(p, 'utf8');
      assert.ok(src.includes('export class') || src.includes('export const') || src.includes('export function'), `${comp} must export class, function or constant`);
    }
  });

  // 4. Check all 10 domain views
  await test('All 10 domain views exist and export mounting classes', async () => {
    const views = [
      'LoginView.js',
      'DashboardView.js',
      'EmployeesView.js',
      'LeaveView.js',
      'PayrollView.js',
      'ShiftsView.js',
      'AnnouncementsView.js',
      'ConcernsView.js',
      'AuditView.js',
      'SettingsView.js',
    ];

    for (const v of views) {
      const p = path.join(adminDir, 'js/views', v);
      assert.ok(fs.existsSync(p), `views/${v} must exist`);
      const src = fs.readFileSync(p, 'utf8');
      const className = v.replace('.js', '');
      assert.ok(src.includes(`export class ${className}`), `Must export class ${className}`);
      assert.ok(src.includes('mount('), `${className} must have mount() method`);
    }
  });

  // 5. Check API client and services
  await test('API client and domain services exist with proper CSRF and cookie credentials', async () => {
    const clientPath = path.join(adminDir, 'js/api/client.js');
    const servicesPath = path.join(adminDir, 'js/api/services.js');

    assert.ok(fs.existsSync(clientPath), 'client.js must exist');
    assert.ok(fs.existsSync(servicesPath), 'services.js must exist');

    const clientSrc = fs.readFileSync(clientPath, 'utf8');
    assert.ok(clientSrc.includes("credentials: 'same-origin'") || clientSrc.includes("credentials: 'include'"), 'Fetch client must include credentials');
    assert.ok(clientSrc.includes('X-CSRF-Token'), 'Fetch client must inject CSRF token header');
  });

  // 6. Check Store and Router
  await test('Reactive store and hash router exist with RBAC protection', async () => {
    const storePath = path.join(adminDir, 'js/state/store.js');
    const routerPath = path.join(adminDir, 'js/router/router.js');

    assert.ok(fs.existsSync(storePath), 'store.js must exist');
    assert.ok(fs.existsSync(routerPath), 'router.js must exist');

    const storeSrc = fs.readFileSync(storePath, 'utf8');
    const routerSrc = fs.readFileSync(routerPath, 'utf8');

    assert.ok(storeSrc.includes('hasPermission('), 'Store must implement hasPermission');
    assert.ok(routerSrc.includes('requiredPermission'), 'Router must enforce requiredPermission');
  });

  // 7. Check Static Server Integration
  await test('Express server serves /admin/ and static files without error', async () => {
    const app = require('../server');
    const server = http.createServer(app);

    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    function get(urlPath) {
      return new Promise((resolve, reject) => {
        http.get(`http://127.0.0.1:${port}${urlPath}`, (res) => {
          let body = '';
          res.on('data', (chunk) => (body += chunk));
          res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
        }).on('error', reject);
      });
    }

    try {
      const resHtml = await get('/admin/');
      assert.strictEqual(resHtml.status, 200, '/admin/ must return 200 OK');
      assert.ok(resHtml.body.includes('Elaraby Connect'), 'Must serve HTML with title');

      const resCss = await get('/admin/css/design-system.css');
      assert.strictEqual(resCss.status, 200, 'design-system.css must return 200 OK');
      assert.ok(resCss.headers['content-type'].includes('text/css'), 'CSS must have text/css content type');

      const resJs = await get('/admin/js/app.js');
      assert.strictEqual(resJs.status, 200, 'app.js must return 200 OK');
      assert.ok(resJs.headers['content-type'].includes('javascript'), 'JS must have javascript content type');
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  console.log(`\nPhase 3 Tests Finished: ${passed} Passed, ${failed} Failed`);
  if (failed > 0) process.exit(1);
}

runPhase3Tests().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
