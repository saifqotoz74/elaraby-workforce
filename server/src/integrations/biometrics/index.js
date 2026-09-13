// Enterprise Biometric Integration Gateway
const MockBiometricAdapter = require('./MockBiometricAdapter');
const { dispatchJob, QUEUE_NAMES } = require('../../queue/queues');

const defaultAdapter = new MockBiometricAdapter();

/**
 * Ingests a batch of biometric punches, normalizes them, and queues them for processing.
 * @param {Array<Object>} punches - Raw punches from time-clock terminals
 * @returns {Promise<{ accepted: number, status: string, jobId: string }>}
 */
async function ingest(punches = []) {
  if (!Array.isArray(punches) || punches.length === 0) {
    return { accepted: 0, status: 'empty' };
  }

  const normalized = punches.map((p) => defaultAdapter.normalizePunch(p));
  await defaultAdapter.ingestPunches(normalized);

  // Queue to BullMQ attendance-sync queue for non-blocking processing
  const job = await dispatchJob(QUEUE_NAMES.ATTENDANCE_SYNC, 'process_biometric_punches', {
    count: normalized.length,
    punches: normalized,
    ingestedAt: Date.now(),
  });

  return {
    accepted: normalized.length,
    status: 'queued',
    jobId: job.jobId,
  };
}

module.exports = {
  ingest,
  getAdapter: () => defaultAdapter,
  normalizePunch: (p) => defaultAdapter.normalizePunch(p),
  parseCsvFile: (c) => defaultAdapter.parseCsvFile(c),
};
