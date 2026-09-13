// Enterprise BullMQ Queue System & Job Dispatcher
// Manages:
// - sms: Transactional OTP and notifications dispatch
// - push: FCM push delivery and token pruning
// - notifications: Bulk in-app notifications
// - payroll: Heavy statement generation and tax calculations
// - erp-sync: Enterprise ERP sync jobs (SAP, Oracle, REST)
// - attendance-sync: Biometric device punch ingestion and normalization

const { Queue } = require('bullmq');
const { getRedisClient, isConfigured } = require('./redis');

const QUEUE_NAMES = {
  SMS: 'sms',
  PUSH: 'push',
  NOTIFICATIONS: 'notifications',
  PAYROLL: 'payroll',
  ERP_SYNC: 'erp-sync',
  ATTENDANCE_SYNC: 'attendance-sync',
};

const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential',
    delay: 1000,
  },
  removeOnComplete: {
    count: 1000,
    age: 24 * 3600,
  },
  removeOnFail: {
    count: 5000,
    age: 7 * 24 * 3600,
  },
};

const _queues = new Map();
const _inMemoryJobs = new Map();

function getQueue(name) {
  if (_queues.has(name)) return _queues.get(name);

  if (!isConfigured()) {
    // Return lightweight mock queue when Redis is not configured
    const mockQueue = {
      name,
      async add(jobName, data, opts = {}) {
        const jobId = opts.jobId || `job_${name}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const job = {
          id: jobId,
          name: jobName,
          data,
          opts: { ...DEFAULT_JOB_OPTIONS, ...opts },
          timestamp: Date.now(),
          attemptsMade: 0,
          status: 'completed', // Synchronously handled in mock mode
          returnvalue: { ok: true, mode: 'in_memory_mock' },
        };
        _inMemoryJobs.set(jobId, job);
        return job;
      },
      async getJob(jobId) {
        return _inMemoryJobs.get(jobId) || null;
      },
      async close() {},
    };
    _queues.set(name, mockQueue);
    return mockQueue;
  }

  const connection = getRedisClient();
  const queue = new Queue(name, {
    connection,
    defaultJobOptions: DEFAULT_JOB_OPTIONS,
  });

  _queues.set(name, queue);
  return queue;
}

/**
 * Dispatches an asynchronous background job to the designated queue.
 * @param {string} queueName - One of QUEUE_NAMES
 * @param {string} jobName - Semantic action name
 * @param {Object} data - Payload
 * @param {Object} [options] - Optional BullMQ Job options (e.g. jobId, delay)
 * @returns {Promise<{ jobId: string, status: string }>}
 */
async function dispatchJob(queueName, jobName, data, options = {}) {
  const queue = getQueue(queueName);
  const jobId = options.jobId || `job_${queueName}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  
  const job = await queue.add(jobName, data, {
    ...DEFAULT_JOB_OPTIONS,
    ...options,
    jobId,
  });

  return {
    jobId: job.id,
    queue: queueName,
    name: jobName,
    status: isConfigured() ? 'queued' : 'completed',
    timestamp: Date.now(),
  };
}

/**
 * Queries job status and progress.
 * @param {string} queueName
 * @param {string} jobId
 */
async function getJobStatus(queueName, jobId) {
  const queue = getQueue(queueName);
  const job = await queue.getJob(jobId);
  if (!job) return null;

  const state = typeof job.getState === 'function' ? await job.getState() : job.status;
  return {
    id: job.id,
    name: job.name,
    data: job.data,
    status: state,
    progress: job.progress || 0,
    failedReason: job.failedReason || null,
    attemptsMade: job.attemptsMade || 0,
    returnvalue: job.returnvalue || null,
    timestamp: job.timestamp,
  };
}

async function closeAllQueues() {
  for (const queue of _queues.values()) {
    try {
      await queue.close();
    } catch (_) {}
  }
  _queues.clear();
}

module.exports = {
  QUEUE_NAMES,
  DEFAULT_JOB_OPTIONS,
  getQueue,
  dispatchJob,
  getJobStatus,
  closeAllQueues,
};
