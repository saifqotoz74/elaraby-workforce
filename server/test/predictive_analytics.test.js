'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const predictiveAnalytics = require('../src/services/predictiveAnalyticsService');
const { signToken } = require('../src/auth');

const app = express();
app.use(express.json());
app.use('/api/admin', require('../src/routes/admin'));

let server;
let baseUrl;
const adminToken = signToken({ sub: 'admin_sys', username: 'admin', role: 'superadmin', scope: 'admin' });

function request(method, path, headers = {}, body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, baseUrl);
    const req = http.request(url, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        let json = null;
        try {
          json = JSON.parse(data);
        } catch (_) {}
        resolve({ status: res.statusCode, headers: res.headers, body: data, json });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

test('=== AI PREDICTIVE ANALYTICS TEST SUITE ===', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  // 1. Probabilistic Absenteeism Modeling
  await t.test('1. Shift Absenteeism Risk Modeling & Day-of-Week Weights', () => {
    const thursdayForecast = predictiveAnalytics.predictShiftAbsenteeism({
      tenantId: 'elaraby',
      targetDate: '2026-09-24', // Thursday (higher absence weight)
    });

    assert.equal(thursdayForecast.ok, true);
    assert.equal(thursdayForecast.dayOfWeek, 'thursday');
    assert.ok(thursdayForecast.overallAbsenteeismRisk >= 0 && thursdayForecast.overallAbsenteeismRisk <= 1.0);
    assert.ok(Array.isArray(thursdayForecast.shiftPredictions));
    assert.equal(thursdayForecast.shiftPredictions.length, 3); // morning, evening, night

    const nightShift = thursdayForecast.shiftPredictions.find((s) => s.shift === 'night');
    const morningShift = thursdayForecast.shiftPredictions.find((s) => s.shift === 'morning');
    assert.ok(nightShift.averageRiskScore >= morningShift.averageRiskScore, 'Night shifts must have higher circadian fatigue weight');

    // Friday check (weekend)
    const fridayForecast = predictiveAnalytics.predictShiftAbsenteeism({
      tenantId: 'elaraby',
      targetDate: '2026-09-25', // Friday
    });
    assert.equal(fridayForecast.dayOfWeek, 'friday');
  });

  // 2. Overtime Expenditure Drift Forecasting
  await t.test('2. Overtime Expenditure Drift Forecasting against Budget Limits', () => {
    // Normal budget scenario
    const safeForecast = predictiveAnalytics.forecastOvertimeDrift({
      tenantId: 'elaraby',
      month: '2026-09',
      budgetLimitEgp: 500000,
    });
    assert.equal(safeForecast.ok, true);
    assert.equal(safeForecast.isBudgetExceeded, false);
    assert.equal(safeForecast.alertSeverity, 'NORMAL');
    assert.ok(safeForecast.recommendations.length >= 1);

    // Exceeded budget scenario
    const breachForecast = predictiveAnalytics.forecastOvertimeDrift({
      tenantId: 'elaraby',
      month: '2026-09',
      budgetLimitEgp: 1000, // unrealistically low budget to trigger breach
    });
    assert.equal(breachForecast.ok, true);
    assert.equal(breachForecast.isBudgetExceeded, true);
    assert.ok(['WARNING', 'CRITICAL'].includes(breachForecast.alertSeverity));
    assert.ok(breachForecast.driftVarianceEgp > 0);
  });

  // 3. Proactive Smart Crew Backfill Recommendations
  await t.test('3. Proactive Smart Crew Backfilling Recommendations', () => {
    const backfill = predictiveAnalytics.recommendCrewBackfill({
      tenantId: 'elaraby',
      shift: 'morning',
      date: '2026-09-22',
      requiredCount: 3,
    });

    assert.equal(backfill.ok, true);
    assert.ok(Array.isArray(backfill.recommendations));
    assert.ok(backfill.recommendedCount <= 3);

    for (const rec of backfill.recommendations) {
      assert.ok(rec.suitabilityScore >= 50);
      assert.equal(rec.egyptianLaborLawCompliant, true);
      assert.ok(rec.restHoursGuaranteed >= 11, 'Must guarantee at least 11h turnaround rest');
    }
  });

  // 4. HTTP Admin Endpoints Integration
  await t.test('4. HTTP Admin Endpoints for Predictive Analytics', async () => {
    // GET /absenteeism
    const absRes = await request('GET', '/api/admin/analytics/predictive/absenteeism?tenantId=elaraby', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(absRes.status, 200);
    assert.equal(absRes.json.ok, true);
    assert.ok(absRes.json.shiftPredictions.length >= 1);

    // GET /overtime-drift
    const driftRes = await request('GET', '/api/admin/analytics/predictive/overtime-drift?budgetLimit=100000', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(driftRes.status, 200);
    assert.equal(driftRes.json.ok, true);
    assert.ok(driftRes.json.projectedOvertimeCost !== undefined);

    // POST /recommend-backfill
    const backfillRes = await request('POST', '/api/admin/analytics/predictive/recommend-backfill', {
      Authorization: `Bearer ${adminToken}`,
    }, {
      shift: 'evening',
      requiredCount: 2,
    });
    assert.equal(backfillRes.status, 200);
    assert.equal(backfillRes.json.ok, true);
    assert.ok(Array.isArray(backfillRes.json.recommendations));
  });
});
