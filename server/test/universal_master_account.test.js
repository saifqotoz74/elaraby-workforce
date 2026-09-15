// Test Suite: Universal Master Account Across All Tenants (Present & Future)
const http = require('http');
const app = require('../server');

let server;
let port;

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {}),
          ...headers,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch (_) {}
          resolve({ status: res.statusCode, headers: res.headers, body: data, json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

async function runTests() {
  console.log('===============================================================');
  console.log('--- TEST SUITE: UNIVERSAL MASTER ACCOUNT ACROSS ALL TENANTS ---');
  console.log('===============================================================\n');

  server = http.createServer(app);
  await new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      port = server.address().port;
      resolve();
    });
  });

  const testTenants = [
    { tenant: 'elaraby', expectedCompany: 'مجموعة العربي', currency: 'EGP' },
    { tenant: 'elsewedy', expectedCompany: 'السويدي إليكتريك', currency: 'EGP' },
    { tenant: 'ghabbour', expectedCompany: 'غبور جي بي كورب', currency: 'EGP' },
    { tenant: 'tmg', expectedCompany: 'مجموعة طلعت مصطفى', currency: 'EGP' },
    { tenant: 'gulf_industrial', expectedCompany: 'الخليج للصناعات', currency: 'SAR' },
    { tenant: 'neom_future_corp_2028', expectedCompany: 'NEOM_FUTURE_CORP_2028', currency: 'EGP' },
  ];

  for (const t of testTenants) {
    console.log(`\n--- Testing Master Account on Tenant: [${t.tenant}] ---`);

    // 1. Request OTP using National ID 30607301402992
    const otpRes = await request('POST', '/api/auth/otp', { 'X-Tenant-ID': t.tenant }, {
      nationalId: '30607301402992',
    });
    if (otpRes.status !== 200 || !otpRes.json.found) {
      throw new Error(`Failed OTP request for tenant ${t.tenant}: status=${otpRes.status}, body=${otpRes.body}`);
    }
    console.log(`✔ OTP Request for 30607301402992 on [${t.tenant}] succeeded. devCode=${otpRes.json.devCode}`);

    // 2. Verify OTP with master code 123456
    const verifyOtpRes = await request('POST', '/api/auth/otp/verify', { 'X-Tenant-ID': t.tenant }, {
      nationalId: '30607301402992',
      code: '123456',
    });
    if (verifyOtpRes.status !== 200 || !verifyOtpRes.json.ok) {
      throw new Error(`Failed OTP verify for tenant ${t.tenant}: status=${verifyOtpRes.status}`);
    }
    console.log(`✔ OTP Verification succeeded on [${t.tenant}]. Employee: ${verifyOtpRes.json.employee.name} (${verifyOtpRes.json.employee.employeeCode})`);

    // 3. Direct PIN login with Master PIN 1234
    const pinRes = await request('POST', '/api/auth/pin/verify', { 'X-Tenant-ID': t.tenant }, {
      nationalId: '30607301402992',
      pin: '1234',
    });
    if (pinRes.status !== 200 || !pinRes.json.token) {
      throw new Error(`Failed PIN verify for tenant ${t.tenant}: status=${pinRes.status}, body=${pinRes.body}`);
    }
    const token = pinRes.json.token;
    console.log(`✔ PIN Login (1234) succeeded on [${t.tenant}]. Token issued.`);

    // 4. Authenticated /me request
    const meRes = await request('GET', '/api/me', {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': t.tenant,
    });
    if (meRes.status !== 200 || !meRes.json.employee) {
      throw new Error(`Failed /api/me for tenant ${t.tenant}: status=${meRes.status}`);
    }
    console.log(`✔ Authenticated /api/me on [${t.tenant}]: Factory=${meRes.json.employee.factory}, Dept=${meRes.json.employee.department}`);

    // 5. Authenticated /payroll/latest request
    const payRes = await request('GET', '/api/payroll/latest', {
      'Authorization': `Bearer ${token}`,
      'X-Tenant-ID': t.tenant,
    });
    if (payRes.status === 200 && payRes.json.payroll) {
      console.log(`✔ Payslip on [${t.tenant}]: Gross=${payRes.json.payroll.grossSalary}, Net=${payRes.json.payroll.netSalary} ${payRes.json.payroll.currency}`);
    }
  }

  // Also verify universal Master Phone 01229105279 on future tenant
  console.log('\n--- Testing Master Phone 01229105279 on Future Tenant [future_ai_robotics] ---');
  const futureOtpRes = await request('POST', '/api/auth/otp', { 'X-Tenant-ID': 'future_ai_robotics' }, {
    phone: '01229105279',
  });
  if (futureOtpRes.status !== 200 || !futureOtpRes.json.found) {
    throw new Error(`Failed OTP for phone on future tenant: status=${futureOtpRes.status}`);
  }
  const vipPinRes = await request('POST', '/api/auth/pin/verify', { 'X-Tenant-ID': 'future_ai_robotics' }, {
    nationalId: '30607301402992',
    pin: '1234',
  });
  if (vipPinRes.status !== 200 || !vipPinRes.json.token) {
    throw new Error(`Failed PIN verify on future tenant: status=${vipPinRes.status}`);
  }
  console.log(`✔ Master Account login succeeded on future tenant [future_ai_robotics]!`);

  server.close();
  console.log('\n===============================================================');
  console.log('🎉 ALL MASTER UNIVERSAL ACCOUNT TESTS PASSED 100% PERFECTLY!');
  console.log('===============================================================\n');
}

runTests().catch((err) => {
  console.error('❌ Test failed:', err);
  if (server) server.close();
  process.exit(1);
});
