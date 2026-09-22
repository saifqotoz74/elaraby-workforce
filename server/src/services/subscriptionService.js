// Subscription Lifecycle Service
// Manages tenant subscription records: creation, renewal, status checking,
// expiry enforcement, grace periods, and platform owner email alerts.
//
// Subscription Status Flow:
//   active -> warning (7 days before expiry) -> frozen (3 days grace after expiry)
//
// Storage: db.json["subscriptions"] array — compatible with existing dual-mode architecture.

'use strict';

const { data: db, save } = require('../db');
const { getCurrentTenantId } = require('../tenantContext');

const WARNING_DAYS = 7;   // days before expiry to start showing warnings
const GRACE_DAYS   = 3;   // days after expiry before hard freeze
const MS_PER_DAY   = 24 * 60 * 60 * 1000;

// ─── Internal helpers ─────────────────────────────────────────────────────────

function _subscriptions() {
  const d = db();
  d.subscriptions = d.subscriptions || [];
  return d.subscriptions;
}

function _daysUntilExpiry(expiresAt) {
  const now = Date.now();
  const exp = new Date(expiresAt).getTime();
  return Math.ceil((exp - now) / MS_PER_DAY);
}

// ─── Exported API ─────────────────────────────────────────────────────────────

/**
 * Get the most recent subscription record for a tenant.
 * Returns null if no subscription exists.
 */
function getActiveSubscription(tenantId) {
  const subs = _subscriptions();
  const tenantSubs = subs
    .filter((s) => s.tenantId === tenantId)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  return tenantSubs[0] || null;
}

/**
 * Returns enriched subscription status for a tenant.
 * {
 *   status: 'active' | 'warning' | 'frozen' | 'cancelled' | 'none',
 *   daysUntilExpiry: number | null,
 *   expiresAt: string | null,
 *   plan: string | null,
 *   seatCount: number | null,
 *   gracePeriodEndsAt: string | null,
 * }
 */
function getSubscriptionStatus(tenantId) {
  const sub = getActiveSubscription(tenantId);

  if (!sub) {
    return {
      status: 'none',
      daysUntilExpiry: null,
      expiresAt: null,
      plan: null,
      seatCount: null,
      gracePeriodEndsAt: null,
    };
  }

  if (sub.status === 'cancelled') {
    return {
      status: 'cancelled',
      daysUntilExpiry: null,
      expiresAt: sub.expiresAt,
      plan: sub.plan,
      seatCount: sub.seatCount,
      gracePeriodEndsAt: null,
    };
  }

  const days = _daysUntilExpiry(sub.expiresAt);
  const gracePeriodEndsAt = new Date(
    new Date(sub.expiresAt).getTime() + GRACE_DAYS * MS_PER_DAY
  ).toISOString();

  let status;
  if (days > WARNING_DAYS) {
    status = 'active';
  } else if (days > 0) {
    status = 'warning';
  } else if (days > -GRACE_DAYS) {
    status = 'frozen'; // within grace period but expired
  } else {
    status = 'frozen'; // fully past grace period
  }

  return {
    status,
    daysUntilExpiry: days,
    expiresAt: sub.expiresAt,
    plan: sub.plan,
    seatCount: sub.seatCount,
    gracePeriodEndsAt,
  };
}

/**
 * Create a new subscription for a tenant.
 * @param {string} tenantId
 * @param {object} opts { plan, seatCount, durationDays, contactEmail? }
 */
function createSubscription(tenantId, { plan = 'enterprise', seatCount = 500, durationDays = 365, contactEmail = null } = {}) {
  const d = db();
  d.subscriptions = d.subscriptions || [];

  const now = new Date();
  const expiresAt = new Date(now.getTime() + durationDays * MS_PER_DAY).toISOString();

  const sub = {
    id: `sub_${tenantId}_${Date.now()}`,
    tenantId,
    plan,
    seatCount: parseInt(seatCount, 10) || 500,
    startDate: now.toISOString(),
    expiresAt,
    status: 'active',
    contactEmail: contactEmail || null,
    renewedAt: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  };

  d.subscriptions.push(sub);
  save();
  return sub;
}

/**
 * Renew an existing subscription by extending its expiry date.
 * @param {string} tenantId
 * @param {number} durationDays number of days to extend from now
 */
function renewSubscription(tenantId, durationDays = 365) {
  const d = db();
  d.subscriptions = d.subscriptions || [];

  const sub = getActiveSubscription(tenantId);
  if (!sub) {
    throw Object.assign(new Error('no_subscription_found'), { statusCode: 404 });
  }

  const now = new Date();
  // Extend from today (not from old expiry) to avoid accumulating dead time
  const newExpiry = new Date(now.getTime() + durationDays * MS_PER_DAY).toISOString();

  const idx = d.subscriptions.findIndex((s) => s.id === sub.id);
  if (idx !== -1) {
    d.subscriptions[idx].expiresAt = newExpiry;
    d.subscriptions[idx].status = 'active';
    d.subscriptions[idx].renewedAt = now.toISOString();
    d.subscriptions[idx].updatedAt = now.toISOString();
    save();
    return d.subscriptions[idx];
  }
  return sub;
}

/**
 * Cancel a subscription for a tenant.
 */
function cancelSubscription(tenantId, reason = '') {
  const d = db();
  d.subscriptions = d.subscriptions || [];

  const sub = getActiveSubscription(tenantId);
  if (!sub) {
    throw Object.assign(new Error('no_subscription_found'), { statusCode: 404 });
  }

  const idx = d.subscriptions.findIndex((s) => s.id === sub.id);
  if (idx !== -1) {
    d.subscriptions[idx].status = 'cancelled';
    d.subscriptions[idx].cancelledAt = new Date().toISOString();
    d.subscriptions[idx].cancelReason = reason;
    d.subscriptions[idx].updatedAt = new Date().toISOString();
    save();
  }
  return d.subscriptions[idx] || sub;
}

/**
 * List all subscriptions across all tenants (for super-admin global overview).
 */
function listAllSubscriptions() {
  return _subscriptions().slice().sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

/**
 * Get enriched subscription status for all tenants — used for Global Analytics.
 */
function getAllSubscriptionStatuses() {
  const subs = _subscriptions();
  const byTenant = {};
  for (const sub of subs) {
    if (!byTenant[sub.tenantId] || new Date(sub.createdAt) > new Date(byTenant[sub.tenantId].createdAt)) {
      byTenant[sub.tenantId] = sub;
    }
  }
  return Object.values(byTenant).map((sub) => ({
    ...sub,
    ...getSubscriptionStatus(sub.tenantId),
    tenantId: sub.tenantId,
  }));
}

/**
 * Daily check: identify tenants whose subscriptions are expiring within WARNING_DAYS
 * and send a platform owner email notification (one email per warning window).
 * Called on server startup and can be scheduled via setInterval.
 */
async function checkAndSendExpiryAlerts() {
  const ownerEmail = process.env.PLATFORM_OWNER_EMAIL;
  if (!ownerEmail) return; // No owner email configured — skip silently

  const statuses = getAllSubscriptionStatuses();
  const expiringSoon = statuses.filter(
    (s) => s.status === 'warning' && s.daysUntilExpiry !== null && s.daysUntilExpiry <= WARNING_DAYS && s.daysUntilExpiry > 0
  );

  if (expiringSoon.length === 0) return;

  // Attempt to send email via Nodemailer if available
  try {
    const nodemailer = require('nodemailer');
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = parseInt(process.env.SMTP_PORT || '587', 10);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;

    if (!smtpHost || !smtpUser || !smtpPass) {
      // SMTP not configured — log warning only
      console.warn('[subscription] SMTP not configured. Expiry alert not sent for:', expiringSoon.map((s) => s.tenantId).join(', '));
      return;
    }

    const transporter = nodemailer.createTransport({
      host: smtpHost,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: { user: smtpUser, pass: smtpPass },
    });

    const tenantList = expiringSoon
      .map(
        (s) =>
          `  • Tenant: ${s.tenantId} | Plan: ${s.plan} | Seats: ${s.seatCount} | Expires: ${new Date(s.expiresAt).toLocaleDateString('en-GB')} (${s.daysUntilExpiry} days)`
      )
      .join('\n');

    await transporter.sendMail({
      from: `"Workforce OS Platform" <${smtpUser}>`,
      to: ownerEmail,
      subject: `⚠️ Workforce OS — ${expiringSoon.length} Subscription(s) Expiring Soon`,
      text: [
        'Workforce OS — Subscription Expiry Alert',
        '=========================================',
        `The following ${expiringSoon.length} tenant subscription(s) will expire within ${WARNING_DAYS} days:`,
        '',
        tenantList,
        '',
        'Please contact each company to arrange renewal before their access is frozen.',
        '',
        `Grace Period: ${GRACE_DAYS} days after expiry before Read-Only freeze is applied.`,
        '',
        '— Workforce OS Platform Monitor',
      ].join('\n'),
    });

    console.log(`[subscription] Expiry alert sent to ${ownerEmail} for ${expiringSoon.length} tenant(s).`);
  } catch (err) {
    console.error('[subscription] Failed to send expiry alert email:', err.message);
  }
}

/**
 * Start the daily alert scheduler. Called once on server startup.
 */
function startAlertScheduler() {
  if (process.env.NODE_ENV === 'test') return;

  // Run once immediately on startup
  checkAndSendExpiryAlerts().catch(() => {});

  // Then every 24 hours
  const timer = setInterval(() => {
    checkAndSendExpiryAlerts().catch(() => {});
  }, 24 * 60 * 60 * 1000);
  if (timer.unref) timer.unref();
}

module.exports = {
  getActiveSubscription,
  getSubscriptionStatus,
  createSubscription,
  renewSubscription,
  cancelSubscription,
  listAllSubscriptions,
  getAllSubscriptionStatuses,
  checkAndSendExpiryAlerts,
  startAlertScheduler,
  WARNING_DAYS,
  GRACE_DAYS,
};
