// Enterprise BullMQ Worker System
// Processes asynchronous jobs from Redis queues:
// - sms: Dispatches SMS via SMS provider adapter
// - push: Sends FCM push notifications via push provider adapter
// - notifications: Bulk database notifications
// - payroll: Heavy salary calculations
// - erp-sync: Enterprise ERP sync runs
// - attendance-sync: Biometric punch ingestion

const { Worker } = require('bullmq');
const { getRedisClient, isConfigured } = require('./redis');
const { QUEUE_NAMES } = require('./queues');

const _workers = new Map();
const CONCURRENCY = parseInt(process.env.WORKER_CONCURRENCY || '5', 10);

// Default handler stubs (pluggable by services)
const handlers = {
  async sms(job) {
    const { to, body, tenantId, senderId, provider } = job.data;
    const sms = require('../integrations/sms');
    const result = await sms.send(to, body, { tenantId, senderId, provider });
    return { delivered: !!result, to, senderId, tenantId, timestamp: Date.now() };
  },

  async push(job) {
    const { token, title, body, data } = job.data;
    const push = require('../integrations/push');
    const result = await push.sendToToken(token, title, body, data);
    return { delivered: !!result, token, timestamp: Date.now() };
  },

  async notifications(job) {
    const { employeeId, title, body, category } = job.data;
    const db = require('../db');
    const nextId = db.nextId('notification');
    const notif = {
      id: `notif_${nextId}`,
      employeeId: employeeId || null,
      title,
      body,
      category: category || 'general',
      read: false,
      createdAt: Date.now(),
    };
    db.withTransaction((d) => {
      d.notifications = d.notifications || [];
      d.notifications.unshift(notif);
    });
    return { notificationId: notif.id, employeeId };
  },

  async payroll(job) {
    const { month, year, employeeId } = job.data;
    return { status: 'prepared', month, year, employeeId, processedAt: Date.now() };
  },

  async erpSync(job) {
    const { domain, options } = job.data;
    const erp = require('../integrations/erp');
    const result = await erp.sync(domain, options);
    return result;
  },

  async attendanceSync(job) {
    const { records } = job.data;
    const bio = require('../integrations/biometrics');
    const result = await bio.ingest(records);
    return result;
  },
};

function createWorker(queueName, processor) {
  if (!isConfigured()) {
    console.log(`[worker] Redis not configured. Queue "${queueName}" running in in-process mode.`);
    return null;
  }

  const connection = getRedisClient();
  const worker = new Worker(queueName, processor, {
    connection,
    concurrency: CONCURRENCY,
    lockDuration: 30000,
    stalledInterval: 30000,
  });

  worker.on('completed', (job) => {
    console.log(`[worker:${queueName}] job ${job.id} (${job.name}) completed successfully.`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[worker:${queueName}] job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts?.attempts}): ${err.message}`);
  });

  worker.on('stalled', (jobId) => {
    console.warn(`[worker:${queueName}] job ${jobId} stalled and will be re-processed.`);
  });

  worker.on('error', (err) => {
    console.error(`[worker:${queueName}] worker error:`, err.message);
  });

  _workers.set(queueName, worker);
  return worker;
}

function startAllWorkers() {
  console.log('--- Starting Enterprise BullMQ Background Workers ---');
  createWorker(QUEUE_NAMES.SMS, handlers.sms);
  createWorker(QUEUE_NAMES.PUSH, handlers.push);
  createWorker(QUEUE_NAMES.NOTIFICATIONS, handlers.notifications);
  createWorker(QUEUE_NAMES.PAYROLL, handlers.payroll);
  createWorker(QUEUE_NAMES.ERP_SYNC, handlers.erpSync);
  createWorker(QUEUE_NAMES.ATTENDANCE_SYNC, handlers.attendanceSync);
  console.log(`✔ BullMQ Workers active across 6 queues (Concurrency: ${CONCURRENCY}).`);
}

async function stopAllWorkers() {
  console.log('[worker] Stopping all active BullMQ workers...');
  for (const [name, worker] of _workers.entries()) {
    try {
      await worker.close();
      console.log(`[worker:${name}] closed.`);
    } catch (_) {}
  }
  _workers.clear();
}

module.exports = {
  handlers,
  createWorker,
  startAllWorkers,
  stopAllWorkers,
  getWorkers: () => _workers,
};
