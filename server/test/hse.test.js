const test = require('node:test');
const assert = require('node:assert/strict');
const hseService = require('../src/services/hseService');

test('HSE Service', async (t) => {
  await t.test('createPermit creates hot work permit with pending status', () => {
    const permit = hseService.createPermit('tenant1', 'emp1', { type: 'hot_work', line: 'L1', description: 'desc', precautions: [], validUntil: Date.now() });
    assert.equal(permit.status, 'pending');
    assert.equal(permit.type, 'hot_work');
    assert.ok(permit.id.startsWith('HSE-P-tenant1-'));
  });

  await t.test('decidePermit approves permit with reviewer signature', () => {
    const permit = hseService.createPermit('tenant1', 'emp1', { type: 'heights' });
    const updated = hseService.decidePermit(permit.id, 'approved', { reviewer: 'rev1', reason: 'looks good' });
    assert.equal(updated.status, 'approved');
    assert.equal(updated.reviewer, 'rev1');
  });

  await t.test('listPermits filters by status', () => {
    hseService.createPermit('tenant2', 'emp1', { type: 'loto' });
    const permits = hseService.listPermits('tenant2', { status: 'pending' });
    assert.ok(permits.length > 0);
    assert.equal(permits[0].status, 'pending');
  });

  await t.test('reportIncident creates incident with severity and open status', () => {
    const incident = hseService.reportIncident('tenant1', 'emp2', { title: 'Spill', severity: 'medium' });
    assert.equal(incident.status, 'open');
    assert.equal(incident.severity, 'medium');
  });

  await t.test('submitPpeInspection calculates compliance score correctly', () => {
    const inspection = hseService.submitPpeInspection('tenant1', 'L1', { helmet: true, shoes: true, earplugs: true, glasses: true, vest: true });
    assert.equal(inspection.complianceScore, 100);
    
    const badInspection = hseService.submitPpeInspection('tenant1', 'L1', { helmet: true, shoes: false });
    assert.equal(badInspection.complianceScore, 50);
  });

  await t.test('getHseSummary returns summary with active permits and LTI days', () => {
    const summary = hseService.getHseSummary('tenant1');
    assert.ok('activePermitsCount' in summary);
    assert.equal(summary.daysWithoutLti, 142);
  });
});
