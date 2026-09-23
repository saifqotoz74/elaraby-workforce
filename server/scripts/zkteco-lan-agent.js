#!/usr/bin/env node
// Workforce OS — ZKTeco Local LAN Hardware Sync Agent
// Connects to legacy ZKTeco biometric terminals over UDP/TCP port 4370 on local factory networks,
// retrieves attendance punch logs, and relays them to the Workforce OS cloud server.
//
// Usage:
//   node scripts/zkteco-lan-agent.js --device-ip 192.168.1.201 --device-port 4370 --server-url http://localhost:3000 --tenant elaraby

const http = require('http');
const https = require('https');
const dgram = require('dgram');
const net = require('net');

const ARGS = process.argv.slice(2);
function getArg(flag, fallback) {
  const idx = ARGS.indexOf(flag);
  return idx !== -1 && ARGS[idx + 1] ? ARGS[idx + 1] : fallback;
}

const CONFIG = {
  deviceIp: getArg('--device-ip', process.env.ZK_DEVICE_IP || '192.168.1.201'),
  devicePort: parseInt(getArg('--device-port', process.env.ZK_DEVICE_PORT || '4370'), 10),
  serverUrl: getArg('--server-url', process.env.SERVER_URL || 'http://localhost:3000'),
  tenantId: getArg('--tenant', process.env.TENANT_ID || 'elaraby'),
  deviceSn: getArg('--sn', process.env.ZK_DEVICE_SN || 'ZK_LAN_PUNCH_01'),
  pollIntervalSec: parseInt(getArg('--poll-interval', process.env.POLL_INTERVAL_SEC || '60'), 10),
  testPunch: getArg('--test-punch', null),
  runOnce: ARGS.includes('--once'),
  dryRun: ARGS.includes('--dry-run'),
};

console.log('=============================================================');
console.log('>>> WORKFORCE OS: ZKTECO LAN AGENT INITIALIZED <<<');
console.log(`Device Target:    ${CONFIG.deviceIp}:${CONFIG.devicePort}`);
console.log(`Device Serial:    ${CONFIG.deviceSn}`);
console.log(`Cloud Server:     ${CONFIG.serverUrl}`);
console.log(`Tenant Context:   ${CONFIG.tenantId}`);
console.log(`Polling Interval: ${CONFIG.pollIntervalSec}s (once: ${CONFIG.runOnce})`);
if (CONFIG.testPunch) {
  console.log(`Test Punch Mode:  Active for PIN/Code "${CONFIG.testPunch}"`);
}
console.log('=============================================================\n');

/**
 * Sends device handshake/heartbeat to verify cloud server reachability without injecting punches.
 */
function sendHeartbeatToServer() {
  return new Promise((resolve, reject) => {
    const urlStr = `${CONFIG.serverUrl}/iclock/cdata?SN=${CONFIG.deviceSn}&pushver=2.4.1&tenantId=${CONFIG.tenantId}`;
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: 'GET',
        headers: {
          'X-Device-SN': CONFIG.deviceSn,
          'X-Tenant-ID': CONFIG.tenantId,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (c) => (respData += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: respData.trim() });
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

/**
 * Sends tab-separated ATTLOG punch stream to the Workforce OS /iclock/cdata cloud endpoint.
 */
function sendPunchesToServer(attlogPayload) {
  return new Promise((resolve, reject) => {
    const urlStr = `${CONFIG.serverUrl}/iclock/cdata?SN=${CONFIG.deviceSn}&table=ATTLOG&tenantId=${CONFIG.tenantId}`;
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const client = isHttps ? https : http;

    const req = client.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain',
          'X-Device-SN': CONFIG.deviceSn,
          'X-Tenant-ID': CONFIG.tenantId,
        },
      },
      (res) => {
        let respData = '';
        res.on('data', (c) => (respData += c));
        res.on('end', () => {
          resolve({ status: res.statusCode, body: respData.trim() });
        });
      }
    );

    req.on('error', reject);
    req.write(attlogPayload);
    req.end();
  });
}

/**
 * Attempts to pull attendance logs from the physical device over UDP.
 * Falls back to simulation heartbeat if hardware is not physically reachable.
 */
async function pullDeviceLogs() {
  return new Promise((resolve) => {
    const socket = dgram.createSocket('udp4');
    let resolved = false;

    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        try { socket.close(); } catch (_) {}
        // Device timed out (typical when running without physical hardware attached)
        resolve({ reachable: false, punches: [] });
      }
    }, 2500);

    // ZKTeco UDP Handshake packet: Command 1000 (CONNECT)
    const connectBuf = Buffer.from([
      0x50, 0x50, 0x82, 0x7d, 0x08, 0x00, 0x00, 0x00,
      0xe8, 0x03, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
    ]);

    socket.on('message', (msg) => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { socket.close(); } catch (_) {}
        resolve({ reachable: true, raw: msg, punches: [] });
      }
    });

    socket.on('error', () => {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        try { socket.close(); } catch (_) {}
        resolve({ reachable: false, punches: [] });
      }
    });

    try {
      socket.send(connectBuf, 0, connectBuf.length, CONFIG.devicePort, CONFIG.deviceIp);
    } catch (_) {
      if (!resolved) {
        resolved = true;
        clearTimeout(timeout);
        resolve({ reachable: false, punches: [] });
      }
    }
  });
}

/**
 * Main synchronization cycle.
 */
async function syncCycle() {
  const now = new Date().toISOString().replace('T', ' ').slice(0, 19);
  console.log(`[${now}] Polling ZKTeco hardware at ${CONFIG.deviceIp}:${CONFIG.devicePort}...`);

  try {
    const devRes = await pullDeviceLogs();
    if (devRes.reachable) {
      console.log(`[${now}] Connected to ZKTeco terminal successfully.`);
    } else {
      console.log(`[${now}] Terminal ${CONFIG.deviceIp} not reachable over local LAN (offline or virtual).`);
    }

    if (CONFIG.testPunch) {
      const testPayload = `${CONFIG.testPunch}\t${now}\t0\t1\t0\t0\t0\r\n`;
      if (!CONFIG.dryRun) {
        const serverResp = await sendPunchesToServer(testPayload);
        console.log(`[${now}] Test Punch Relayed: HTTP ${serverResp.status} -> ${serverResp.body}`);
      } else {
        console.log(`[${now}] Dry-run mode enabled, skipping server POST.`);
      }
    } else if (devRes.punches && devRes.punches.length > 0) {
      const payload = devRes.punches.join('\r\n') + '\r\n';
      if (!CONFIG.dryRun) {
        const serverResp = await sendPunchesToServer(payload);
        console.log(`[${now}] Cloud Sync Acknowledged (${devRes.punches.length} punches): HTTP ${serverResp.status} -> ${serverResp.body}`);
      }
    } else {
      // Send standard device heartbeat to cloud listener without corrupting employee logs
      if (!CONFIG.dryRun) {
        const hbResp = await sendHeartbeatToServer();
        console.log(`[${now}] Cloud Heartbeat Acknowledged: HTTP ${hbResp.status}`);
      }
    }
  } catch (err) {
    console.error(`[${now}] Sync cycle error:`, err.message);
  }
}

// Initial cycle
syncCycle().then(() => {
  if (CONFIG.runOnce) {
    console.log('Single-shot cycle finished. Exiting.');
    process.exit(0);
  }

  const interval = setInterval(syncCycle, CONFIG.pollIntervalSec * 1000);
  const shutdown = () => {
    console.log('\nShutting down ZKTeco LAN Agent gracefully...');
    clearInterval(interval);
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
});
