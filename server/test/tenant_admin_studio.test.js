// Enterprise Brand Studio & Tenant Customizer Backend Test Suite
const test = require('node:test');
const assert = require('node:assert');
const http = require('http');
const app = require('../server');
const { signToken } = require('../src/auth');
const { ROLES } = require('../src/rbac');
const realtimeService = require('../src/services/realtimeService');

function request(method, path, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const server = http.createServer(app);
    server.listen(0, () => {
      const port = server.address().port;
      const reqHeaders = { 'Content-Type': 'application/json', ...headers };
      const req = http.request(
        {
          hostname: '127.0.0.1',
          port,
          path,
          method,
          headers: reqHeaders,
        },
        (res) => {
          let rawData = '';
          res.on('data', (chunk) => {
            rawData += chunk;
          });
          res.on('end', () => {
            server.close();
            try {
              const parsed = JSON.parse(rawData);
              resolve({ status: res.statusCode, body: parsed });
            } catch (_) {
              resolve({ status: res.statusCode, body: rawData });
            }
          });
        }
      );
      req.on('error', (e) => {
        server.close();
        reject(e);
      });
      if (body) {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
      req.end();
    });
  });
}

const { data: db, save } = require('../src/db');

test('=== ENTERPRISE TENANT BRAND STUDIO & LIVE CUSTOMIZER SUITE ===', async (t) => {
  // Clean up any lingering mutations to built-in presets from prior test runs
  const cleanDb = () => {
    const d = db();
    if (d.tenants) {
      d.tenants = d.tenants.filter((tenant) => tenant.id !== 'elsewedy' && tenant.id !== 'fresh_corp');
      save();
    }
  };
  cleanDb();
  t.after(cleanDb);

  const superAdminToken = signToken({
    sub: 'superadmin',
    role: ROLES.SUPER_ADMIN,
    scope: 'admin',
    scopeFactory: null,
  });

  await t.test('1. GET /api/tenant/config returns rich corporate legal, tax, and geofenced zones', async () => {
    const res = await request('GET', '/api/tenant/config?slug=elsewedy');
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tenant.name, 'Elsewedy Electric');
    assert.strictEqual(res.body.tenant.crNumber, 'EG-284910');
    assert.strictEqual(res.body.tenant.taxNumber, 'EG-284-910-112');
    assert.strictEqual(res.body.tenant.currency, 'EGP');
    assert.ok(Array.isArray(res.body.tenant.factoryGeofences));
    assert.ok(res.body.tenant.factoryGeofences.length >= 2);
    assert.strictEqual(res.body.tenant.factoryGeofences[0].id, 'tenth_ramadan');
  });

  await t.test('2. POST /api/super-admin/tenants provisions a new enterprise tenant with full Brand Studio metadata', async () => {
    let broadcastPayload = null;
    const origBroadcast = realtimeService.broadcast;
    realtimeService.broadcast = (event, payload) => {
      if (event === 'tenant:updated') broadcastPayload = payload;
    };

    const newSlug = `test_corp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const payload = {
      slug: newSlug,
      name: 'PetroJet Industrial',
      nameAr: 'بتروجيت للإنشاءات البترولية',
      crNumber: 'EG-778899',
      taxNumber: 'EG-778-899-001',
      corporateSubtitle: 'Petrochemical & Energy Infrastructure',
      currency: 'EGP',
      brand: {
        primaryColor: '#F59E0B',
        supportHotline: '19000',
      },
      factoryLocations: ['مجمع السويس البترولي', 'حقول العلمين'],
      factoryGeofences: [
        { id: 'suez_hub', name: 'Suez Petrochemical Hub', lat: 29.9668, lng: 32.5498, radiusMeters: 1000 }
      ],
      features: {
        hasBuses: true,
        hasSummerTrips: false,
        hasPayroll: true,
      },
      authMode: 'egyptian_national_id',
    };

    const res = await request(
      'POST',
      '/api/super-admin/tenants',
      payload,
      { Authorization: `Bearer ${superAdminToken}` }
    );

    realtimeService.broadcast = origBroadcast;

    assert.strictEqual(res.status, 201);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tenant.slug, newSlug);
    assert.strictEqual(res.body.tenant.crNumber, 'EG-778899');
    assert.strictEqual(res.body.tenant.taxNumber, 'EG-778-899-001');
    assert.strictEqual(res.body.tenant.brand.primaryColor, '#F59E0B');

    // Verify realtime event was broadcast
    assert.ok(broadcastPayload != null);
    assert.strictEqual(broadcastPayload.slug, newSlug);
    assert.strictEqual(broadcastPayload.crNumber, 'EG-778899');
  });

  await t.test('3. PUT /api/super-admin/tenants/:id updates brand colors and broadcasts live update', async () => {
    let broadcastPayload = null;
    const origBroadcast = realtimeService.broadcast;
    realtimeService.broadcast = (event, payload) => {
      if (event === 'tenant:updated') broadcastPayload = payload;
    };

    const updatePayload = {
      brand: {
        primaryColor: '#D97706',
        supportHotline: '19111',
      },
      features: {
        hasSummerTrips: true,
      },
      crNumber: 'EG-999999',
    };

    const res = await request(
      'PUT',
      '/api/super-admin/tenants/elsewedy',
      updatePayload,
      { Authorization: `Bearer ${superAdminToken}` }
    );

    realtimeService.broadcast = origBroadcast;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.tenant.brand.primaryColor, '#D97706');
    assert.strictEqual(res.body.tenant.features.hasSummerTrips, true);
    assert.strictEqual(res.body.tenant.crNumber, 'EG-999999');

    // Verify broadcast occurred
    assert.ok(broadcastPayload != null);
    assert.strictEqual(broadcastPayload.slug, 'elsewedy');
    assert.strictEqual(broadcastPayload.brand.primaryColor, '#D97706');
  });

  await t.test('4. POST /api/super-admin/tenants/:id/logo updates logo and broadcasts live update', async () => {
    let broadcastPayload = null;
    const origBroadcast = realtimeService.broadcast;
    realtimeService.broadcast = (event, payload) => {
      if (event === 'tenant:updated') broadcastPayload = payload;
    };

    const res = await request(
      'POST',
      '/api/super-admin/tenants/ghabbour/logo',
      { logoUrl: 'https://cdn.example.com/ghabbour_brand_logo.png' },
      { Authorization: `Bearer ${superAdminToken}` }
    );

    realtimeService.broadcast = origBroadcast;

    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.logoUrl, 'https://cdn.example.com/ghabbour_brand_logo.png');

    // Verify broadcast occurred
    assert.ok(broadcastPayload != null);
    assert.strictEqual(broadcastPayload.brand.logoUrl, 'https://cdn.example.com/ghabbour_brand_logo.png');
  });
});
