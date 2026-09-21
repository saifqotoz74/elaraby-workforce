'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const express = require('express');

const analyticsService = require('../src/services/analyticsAggregationService');
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

test('=== WORKFORCE OS EXECUTIVE BI & ANALYTICS AGGREGATION ENGINE SUITE ===', async (t) => {
  await new Promise((resolve) => {
    server = app.listen(0, () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });

  t.after(() => {
    if (server) server.close();
  });

  // 1. Bradford Factor Scoring Mathematical Formula
  await t.test('1. Bradford Factor Scoring Formula (B = S^2 * D) & Severity Bands', () => {
    // Zero / Edge states
    assert.deepEqual(analyticsService.calculateBradfordFactor(0, 0), { score: 0, severity: 'LOW' });
    assert.deepEqual(analyticsService.calculateBradfordFactor(-2, -5), { score: 0, severity: 'LOW' });

    // Low: score < 50 (e.g. 1 spell of 10 days = 1^2 * 10 = 10)
    assert.deepEqual(analyticsService.calculateBradfordFactor(1, 10), { score: 10, severity: 'LOW' });

    // Medium: 50 <= score < 200 (e.g. 3 spells of 6 days = 9 * 6 = 54)
    assert.deepEqual(analyticsService.calculateBradfordFactor(3, 6), { score: 54, severity: 'MEDIUM' });

    // High: 200 <= score < 500 (e.g. 5 spells of 10 days = 25 * 10 = 250)
    assert.deepEqual(analyticsService.calculateBradfordFactor(5, 10), { score: 250, severity: 'HIGH' });

    // Critical: score >= 500 (e.g. 8 spells of 10 days = 64 * 10 = 640)
    assert.deepEqual(analyticsService.calculateBradfordFactor(8, 10), { score: 640, severity: 'CRITICAL' });
    assert.deepEqual(analyticsService.calculateBradfordFactor(10, 5), { score: 500, severity: 'CRITICAL' });
  });

  // 2. In-Memory Aggregator Metrics Consolidation
  await t.test('2. Multi-Domain Analytics Aggregator computes complete enterprise dataset', () => {
    analyticsService.invalidateCache();
    const bi = analyticsService.getBiOverview({ tenantId: 'elaraby', forceRefresh: true });

    assert.equal(bi.ok, true);
    assert.equal(bi.tenantId, 'elaraby');

    // Operational Metrics
    assert.ok(bi.overview.totalHeadcount > 0, 'Total headcount must be positive');
    assert.ok(bi.overview.activeCount > 0, 'Active headcount must be positive');
    assert.ok(bi.overview.todayAttendanceRate >= 0 && bi.overview.todayAttendanceRate <= 100);
    assert.ok(bi.overview.shiftFillRate >= 0 && bi.overview.shiftFillRate <= 100);
    assert.ok(bi.overview.punctualityScore >= 0 && bi.overview.punctualityScore <= 100);
    assert.ok(Array.isArray(bi.overview.turnstileThroughput));
    assert.ok(bi.overview.turnstileThroughput.length >= 6);

    // Absenteeism & Egyptian Heatmap
    assert.ok(bi.absenteeism.overallRate >= 0 && bi.absenteeism.overallRate <= 100);
    assert.ok(Array.isArray(bi.absenteeism.dayOfWeekHeatmap));
    assert.equal(bi.absenteeism.dayOfWeekHeatmap.length, 7);
    const thursday = bi.absenteeism.dayOfWeekHeatmap.find((d) => d.dayKey === 'thu');
    const friday = bi.absenteeism.dayOfWeekHeatmap.find((d) => d.dayKey === 'fri');
    assert.ok(thursday.absenceRate > friday.absenceRate, 'Thursday pre-weekend must have higher absence than Friday');
    assert.ok(Array.isArray(bi.absenteeism.topBradfordRankings));
    assert.ok(bi.absenteeism.topBradfordRankings.length > 0);
    assert.ok(bi.absenteeism.stoppageRiskSummary.overallStatus !== undefined);

    // Overtime & Financial Drift
    assert.ok(bi.overtime.monthlyBudgetEgp > 0);
    assert.ok(bi.overtime.actualSpendToDate >= 0);
    assert.ok(bi.overtime.projectedMonthEndSpend > 0);
    assert.ok(bi.overtime.blendedVelocity >= 0);
    assert.ok(['NORMAL', 'WARNING', 'CRITICAL'].includes(bi.overtime.alertLevel));
    assert.ok(Array.isArray(bi.overtime.budgetBurnCurve));
    assert.equal(bi.overtime.budgetBurnCurve.length, 30);

    // Demographics & Retention
    assert.ok(bi.demographics.annualTurnoverRate >= 0);
    assert.ok(bi.demographics.averageTenureMonths > 0);
    assert.ok(Array.isArray(bi.demographics.departmentBreakdown));
    assert.ok(Array.isArray(bi.demographics.tenureDistribution));
  });

  // 3. Sub-25ms SLA Benchmark
  await t.test('3. High-Performance In-Memory Aggregator satisfies Sub-25ms SLA', () => {
    const iterations = 50;
    const times = [];

    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      const res = analyticsService.getBiOverview({ tenantId: 'elaraby' });
      const elapsedMs = Number(process.hrtime.bigint() - start) / 1e6;
      times.push(elapsedMs);
      assert.ok(res.ok);
    }

    const maxTime = Math.max(...times);
    const avgTime = times.reduce((a, b) => a + b, 0) / iterations;

    assert.ok(maxTime < 25, `Max latency ${maxTime.toFixed(2)}ms must be strictly < 25ms SLA`);
    assert.ok(avgTime < 5, `Average latency ${avgTime.toFixed(2)}ms must be strictly < 5ms`);
  });

  // 4. In-Memory Cache and Invalidation Dynamics
  await t.test('4. In-Memory Cache returns cached snapshot and invalidates correctly', () => {
    analyticsService.invalidateCache();

    // Fresh fetch (not cached)
    const res1 = analyticsService.getBiOverview({ tenantId: 'elaraby' });
    assert.equal(res1.cached, undefined);

    // Cached fetch
    const res2 = analyticsService.getBiOverview({ tenantId: 'elaraby' });
    assert.equal(res2.cached, true);

    // Specific tenant invalidation
    analyticsService.invalidateCache('elaraby');
    const res3 = analyticsService.getBiOverview({ tenantId: 'elaraby' });
    assert.equal(res3.cached, undefined);

    // Global invalidation
    analyticsService.getBiOverview({ tenantId: 'elaraby' });
    analyticsService.invalidateCache();
    const res4 = analyticsService.getBiOverview({ tenantId: 'elaraby' });
    assert.equal(res4.cached, undefined);
  });

  // 5. UTF-8 BOM CSV Export Compliance
  await t.test('5. 1-Click Executive Analytics CSV Export with UTF-8 BOM & RFC 4180', () => {
    const csv = analyticsService.generateAnalyticsReport({ tenantId: 'elaraby', format: 'csv' });

    // Must start with UTF-8 BOM for Microsoft Excel Arabic fidelity
    assert.ok(csv.startsWith('\uFEFF'), 'Export must start with UTF-8 BOM (\\uFEFF)');

    // Must contain key section headers
    assert.ok(csv.includes('SECTION 1: OPERATIONAL ATTENDANCE & FILL RATES'));
    assert.ok(csv.includes('SECTION 2: EGYPTIAN WEEKDAY ABSENTEEISM HEATMAP'));
    assert.ok(csv.includes('SECTION 3: OVERTIME EXPENDITURE DRIFT FORECAST'));
    assert.ok(csv.includes('SECTION 4: TOP BRADFORD FACTOR RANKINGS'));

    // Must contain Arabic characters
    assert.ok(csv.includes('الأحد') || csv.includes('الخميس'));

    // JSON format option
    const jsonReport = analyticsService.generateAnalyticsReport({ tenantId: 'elaraby', format: 'json' });
    assert.equal(jsonReport.ok, true);
    assert.equal(typeof jsonReport.overview, 'object');
  });

  // 6. HTTP Admin Endpoints Integration
  await t.test('6. HTTP Admin Endpoints: /api/admin/analytics/bi-overview & export/report', async () => {
    // Unauthenticated rejection
    const unauth = await request('GET', '/api/admin/analytics/bi-overview');
    assert.equal(unauth.status, 401);

    // Authenticated BI Overview
    const authRes = await request('GET', '/api/admin/analytics/bi-overview?tenantId=elaraby', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(authRes.status, 200);
    assert.equal(authRes.json.ok, true);
    assert.equal(authRes.json.tenantId, 'elaraby');
    assert.ok(authRes.json.overview.shiftFillRate > 0);
    assert.ok(authRes.json.absenteeism.dayOfWeekHeatmap.length === 7);

    // CSV Report Export
    const exportRes = await request('GET', '/api/admin/analytics/export/report?tenantId=elaraby&format=csv', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(exportRes.status, 200);
    assert.ok(exportRes.headers['content-type'].includes('text/csv'));
    assert.ok(exportRes.headers['content-disposition'].includes('attachment'));
    assert.ok(exportRes.body.startsWith('\uFEFF'));

    // JSON Report Export
    const jsonExportRes = await request('GET', '/api/admin/analytics/export/report?tenantId=elaraby&format=json', {
      Authorization: `Bearer ${adminToken}`,
    });
    assert.equal(jsonExportRes.status, 200);
    assert.equal(jsonExportRes.json.ok, true);
  });
});
