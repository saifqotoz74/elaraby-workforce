#!/usr/bin/env node
// Elaraby Connect — Dedicated Enterprise Background Worker Process
// Executes BullMQ queues independently of the API event loop.

require('./src/config').load();
const { startAllWorkers, stopAllWorkers } = require('./src/queue/workers');
const { closeAllQueues } = require('./src/queue/queues');
const { closeRedis } = require('./src/queue/redis');
const postgres = require('./src/db/postgres');

console.log('=============================================================');
console.log('  ELARABY WORKFORCE — ENTERPRISE BACKGROUND WORKER DAEMON    ');
console.log(`  Process PID: ${process.pid} | Node: ${process.version} | Env: ${process.env.NODE_ENV || 'development'}`);
console.log('=============================================================\n');

startAllWorkers();

// Graceful Shutdown
let isShuttingDown = false;
async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;
  console.log(`\n[worker:shutdown] Received ${signal}. Starting graceful shutdown...`);

  try {
    await stopAllWorkers();
    await closeAllQueues();
    await closeRedis();
    await postgres.closePool();
    console.log('[worker:shutdown] All background queues and connections closed cleanly. Exiting.');
    process.exit(0);
  } catch (err) {
    console.error('[worker:shutdown_error]', err.message);
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  console.error('[worker:guard] Unhandled Promise Rejection at:', promise, 'reason:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('[worker:guard] Uncaught Exception:', err.message, err.stack);
});
