// Tenant Discovery & Dynamic White-Label Configuration Routes
const express = require('express');
const router = express.Router();
const { data: db, save } = require('../db');
const { DEFAULT_TENANT_ID } = require('../tenantResolver');
const { requireAdmin, requireRole } = require('../auth');
const { ROLES } = require('../rbac');

// Standard Institutional Presets for fast out-of-the-box white-label support
const BUILTIN_TENANTS = {
  elaraby: {
    id: 'elaraby',
    slug: 'elaraby',
    name: 'Elaraby Group',
    nameAr: 'مجموعة العربي',
    brand: {
      primaryColor: '#0B63B4',
      primaryLightColor: '#1668B8',
      primarySoftColor: '#E8F1FA',
      scaffoldBgColor: '#F3F5F7',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      localLogoAsset: 'assets/images/elaraby_logo.png',
      supportHotline: '19319',
    },
    features: {
      hasShifts: true,
      hasPayroll: true,
      hasVacations: true,
      hasBuses: true,
      hasBenefits: true,
      hasSummerTrips: true,
      hasWhistleblower: true,
      hasSurveys: true,
      hasMedicalNetwork: true,
    },
    authMode: 'egyptian_national_id',
    status: 'active',
  },
  elsewedy: {
    id: 'elsewedy',
    slug: 'elsewedy',
    name: 'Elsewedy Electric',
    nameAr: 'السويدي إليكتريك',
    brand: {
      primaryColor: '#C8102E', // Elsewedy Crimson Red
      primaryLightColor: '#E02B47',
      primarySoftColor: '#FCECEF',
      scaffoldBgColor: '#F8F9FA',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      supportHotline: '16244',
    },
    features: {
      hasShifts: true,
      hasPayroll: true,
      hasVacations: true,
      hasBuses: true,
      hasBenefits: false, // Customized module mix
      hasSummerTrips: false,
      hasWhistleblower: true,
      hasSurveys: true,
      hasMedicalNetwork: true,
    },
    authMode: 'egyptian_national_id',
    status: 'active',
  },
  gulf_industrial: {
    id: 'gulf_industrial',
    slug: 'gulf_industrial',
    name: 'Gulf Industrial Corp',
    nameAr: 'الخليج للصناعات',
    brand: {
      primaryColor: '#059669', // Industrial Emerald Green
      primaryLightColor: '#10B981',
      primarySoftColor: '#ECFDF5',
      scaffoldBgColor: '#F3F4F6',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      supportHotline: '80012345',
    },
    features: {
      hasShifts: true,
      hasPayroll: true,
      hasVacations: true,
      hasBuses: true,
      hasBenefits: true,
      hasSummerTrips: false,
      hasWhistleblower: true,
      hasSurveys: false,
      hasMedicalNetwork: true,
    },
    authMode: 'gulf_iqama',
    status: 'active',
  },
};

/**
 * GET /api/tenant/config
 * Returns active tenant branding, feature matrix, and auth mode.
 */
router.get('/tenant/config', (req, res) => {
  const querySlug = (req.query.slug || req.query.code || req.tenantId || DEFAULT_TENANT_ID).toString().trim().toLowerCase();

  // 1. Check custom tenants in DB
  const d = db();
  const dbTenants = d.tenants || [];
  const dbFound = dbTenants.find((t) => t.id === querySlug || t.slug === querySlug);

  if (dbFound) {
    return res.json({
      success: true,
      tenant: dbFound,
    });
  }

  // 2. Check built-in preset tenants
  if (BUILTIN_TENANTS[querySlug]) {
    return res.json({
      success: true,
      tenant: BUILTIN_TENANTS[querySlug],
    });
  }

  // 3. Fallback to default institutional tenant
  return res.json({
    success: true,
    tenant: BUILTIN_TENANTS[DEFAULT_TENANT_ID],
    fallback: true,
  });
});

/**
 * GET /api/tenant/list
 * Returns list of public active tenants for company onboarding discovery.
 */
router.get('/tenant/list', (req, res) => {
  const d = db();
  const dbTenants = (d.tenants || []).filter((t) => t.status === 'active');

  const all = [
    ...Object.values(BUILTIN_TENANTS),
    ...dbTenants.filter((dbT) => !BUILTIN_TENANTS[dbT.id]),
  ];

  const publicList = all.map((t) => ({
    id: t.id,
    slug: t.slug,
    name: t.name,
    nameAr: t.nameAr,
    primaryColor: t.brand?.primaryColor,
    authMode: t.authMode,
  }));

  res.json({
    success: true,
    tenants: publicList,
  });
});

// ============================================================================
// Platform Super-Admin Provisioning & Tenant Management API
// Guarded strictly by requireAdmin and SUPER_ADMIN role
// ============================================================================

/**
 * GET /api/super-admin/tenants
 * Full management inventory of all tenants, license limits, and employee counts.
 */
router.get('/super-admin/tenants', requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  const d = db();
  const dbTenants = d.tenants || [];
  const employees = d.employees || [];

  const all = [
    ...Object.values(BUILTIN_TENANTS),
    ...dbTenants.filter((dbT) => !BUILTIN_TENANTS[dbT.id]),
  ];

  const fullList = all.map((t) => {
    const tenantEmployees = employees.filter((e) => (e.tenantId || DEFAULT_TENANT_ID) === t.id);
    return {
      ...t,
      employeeCount: tenantEmployees.length,
      isCustom: !BUILTIN_TENANTS[t.id],
    };
  });

  res.json({
    success: true,
    totalTenants: fullList.length,
    tenants: fullList,
  });
});

/**
 * POST /api/super-admin/tenants
 * Provision a brand-new tenant organization with custom branding, modules, and SMS keys.
 */
router.post('/super-admin/tenants', requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  const {
    slug,
    name,
    nameAr,
    brand = {},
    features = {},
    authMode = 'egyptian_national_id',
    smsProvider = 'mock',
    smsSenderId = 'Workforce',
    maxEmployees = 500,
    subscriptionTier = 'enterprise',
  } = req.body;

  if (!slug || !name) {
    return res.status(400).json({ error: 'missing_required_fields', message: 'slug and name are required' });
  }

  const cleanSlug = slug.toString().trim().toLowerCase().replace(/[^a-z0-9_-]/g, '');
  if (!cleanSlug) {
    return res.status(400).json({ error: 'invalid_slug', message: 'slug must contain alphanumeric characters' });
  }

  const d = db();
  d.tenants = d.tenants || [];

  const existsInBuiltin = !!BUILTIN_TENANTS[cleanSlug];
  const existsInDb = d.tenants.some((t) => t.id === cleanSlug || t.slug === cleanSlug);

  if (existsInBuiltin || existsInDb) {
    return res.status(409).json({ error: 'tenant_already_exists', message: `Tenant ${cleanSlug} already exists` });
  }

  const newTenant = {
    id: cleanSlug,
    slug: cleanSlug,
    name: name.trim(),
    nameAr: (nameAr || name).trim(),
    brand: {
      primaryColor: brand.primaryColor || '#0B63B4',
      primaryLightColor: brand.primaryLightColor || '#1D7ED6',
      primarySoftColor: brand.primarySoftColor || '#E8F2FB',
      scaffoldBgColor: brand.scaffoldBgColor || '#F8F9FA',
      surfaceColor: brand.surfaceColor || '#FFFFFF',
      logoUrl: brand.logoUrl || null,
      supportHotline: brand.supportHotline || '19319',
    },
    features: {
      hasShifts: features.hasShifts !== false,
      hasPayroll: features.hasPayroll !== false,
      hasVacations: features.hasVacations !== false,
      hasBuses: features.hasBuses !== false,
      hasBenefits: features.hasBenefits !== false,
      hasSummerTrips: features.hasSummerTrips !== false,
      hasWhistleblower: features.hasWhistleblower !== false,
      hasSurveys: features.hasSurveys !== false,
      hasMedicalNetwork: features.hasMedicalNetwork !== false,
    },
    authMode,
    smsProvider,
    smsSenderId,
    maxEmployees: parseInt(maxEmployees, 10) || 500,
    subscriptionTier,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  d.tenants.push(newTenant);
  save();

  res.status(201).json({
    success: true,
    message: 'tenant_provisioned_successfully',
    tenant: newTenant,
  });
});

/**
 * PUT /api/super-admin/tenants/:id
 * Update configuration, branding, or feature flags of an existing tenant.
 */
router.put('/super-admin/tenants/:id', requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  const targetId = req.params.id.trim().toLowerCase();
  const d = db();
  d.tenants = d.tenants || [];

  let tenant = d.tenants.find((t) => t.id === targetId || t.slug === targetId);

  // If modifying a built-in tenant, clone it into DB first to persist customizations
  if (!tenant && BUILTIN_TENANTS[targetId]) {
    tenant = JSON.parse(JSON.stringify(BUILTIN_TENANTS[targetId]));
    d.tenants.push(tenant);
  }

  if (!tenant) {
    return res.status(404).json({ error: 'tenant_not_found' });
  }

  const { name, nameAr, brand, features, authMode, status, smsProvider, smsSenderId, maxEmployees } = req.body;

  if (name) tenant.name = name.trim();
  if (nameAr) tenant.nameAr = nameAr.trim();
  if (authMode) tenant.authMode = authMode;
  if (status) tenant.status = status;
  if (smsProvider) tenant.smsProvider = smsProvider;
  if (smsSenderId) tenant.smsSenderId = smsSenderId;
  if (maxEmployees !== undefined) tenant.maxEmployees = parseInt(maxEmployees, 10);

  if (brand && typeof brand === 'object') {
    tenant.brand = { ...tenant.brand, ...brand };
  }
  if (features && typeof features === 'object') {
    tenant.features = { ...tenant.features, ...features };
  }

  tenant.updatedAt = new Date().toISOString();
  save();

  res.json({
    success: true,
    message: 'tenant_updated_successfully',
    tenant,
  });
});

/**
 * DELETE /api/super-admin/tenants/:id
 * Soft-deactivates tenant (marks status as 'inactive').
 */
router.delete('/super-admin/tenants/:id', requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  const targetId = req.params.id.trim().toLowerCase();

  if (targetId === DEFAULT_TENANT_ID) {
    return res.status(400).json({ error: 'cannot_deactivate_default_tenant' });
  }

  const d = db();
  d.tenants = d.tenants || [];

  let tenant = d.tenants.find((t) => t.id === targetId || t.slug === targetId);

  if (!tenant && BUILTIN_TENANTS[targetId]) {
    tenant = JSON.parse(JSON.stringify(BUILTIN_TENANTS[targetId]));
    d.tenants.push(tenant);
  }

  if (!tenant) {
    return res.status(404).json({ error: 'tenant_not_found' });
  }

  tenant.status = 'inactive';
  tenant.updatedAt = new Date().toISOString();
  save();

  res.json({
    success: true,
    message: 'tenant_deactivated_successfully',
    tenantId: targetId,
  });
});

module.exports = router;
