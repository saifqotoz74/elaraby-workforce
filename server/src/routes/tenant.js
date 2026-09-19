// Tenant Discovery & Dynamic White-Label Configuration Routes
const express = require('express');
const router = express.Router();
const { data: db, save } = require('../db');
const { DEFAULT_TENANT_ID } = require('../tenantResolver');
const { requireAdmin, requireRole } = require('../auth');
const { ROLES } = require('../rbac');
const realtimeService = require('../services/realtimeService');
const auditService = require('../services/auditService');

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
      localLogoAsset: 'assets/images/app_logo.png',
      supportHotline: '19319',
      crNumber: 'EG-104821',
      taxNumber: 'EG-102-993-841',
      corporateSubtitle: 'Home Appliances & Electronics Manufacturing',
      currency: 'EGP',
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
    crNumber: 'EG-104821',
    taxNumber: 'EG-102-993-841',
    corporateSubtitle: 'Home Appliances & Electronics Manufacturing',
    currency: 'EGP',
    factoryLocations: ['قويسنا الصناعية', 'مجمع بنها الصناعي', 'العبور للخدمات اللوجستية'],
    factoryGeofences: [
      { id: 'quesna', name: 'Quesna Industrial Hub', nameAr: 'قويسنا الصناعية', lat: 30.5489, lng: 31.1472, radiusMeters: 800 },
      { id: 'benha', name: 'Benha Factory Complex', nameAr: 'مجمع بنها الصناعي', lat: 30.4658, lng: 31.1852, radiusMeters: 650 },
    ],
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
      crNumber: 'EG-284910',
      taxNumber: 'EG-284-910-112',
      corporateSubtitle: 'Energy, Cables & Infrastructure Solutions',
      currency: 'EGP',
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
    crNumber: 'EG-284910',
    taxNumber: 'EG-284-910-112',
    corporateSubtitle: 'Energy, Cables & Infrastructure Solutions',
    currency: 'EGP',
    factoryLocations: ['العاشر من رمضان قطاع الكابلات', 'العين السخنة للمحولات', 'السادات للمهمات الكهربائية'],
    factoryGeofences: [
      { id: 'tenth_ramadan', name: '10th of Ramadan Cable Complex', nameAr: 'العاشر من رمضان قطاع الكابلات', lat: 30.2981, lng: 31.7428, radiusMeters: 900 },
      { id: 'sokhna', name: 'Ain Sokhna Transformers Hub', nameAr: 'العين السخنة للمحولات', lat: 29.6200, lng: 32.3400, radiusMeters: 750 },
    ],
    status: 'active',
  },
  ghabbour: {
    id: 'ghabbour',
    slug: 'ghabbour',
    name: 'GB Corp (Ghabbour Auto)',
    nameAr: 'جي بي كورب (غبور أوتو)',
    brand: {
      primaryColor: '#1E3A8A', // Automotive Navy
      primaryLightColor: '#3B82F6',
      primarySoftColor: '#EFF6FF',
      scaffoldBgColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      supportHotline: '19623',
      crNumber: 'EG-550192',
      taxNumber: 'EG-550-192-334',
      corporateSubtitle: 'Automotive Manufacturing & Assembly Lines',
      currency: 'EGP',
    },
    features: {
      hasShifts: true,
      hasPayroll: true,
      hasVacations: true,
      hasBuses: true,
      hasBenefits: true,
      hasSummerTrips: false,
      hasWhistleblower: true,
      hasSurveys: true,
      hasMedicalNetwork: true,
    },
    authMode: 'egyptian_national_id',
    crNumber: 'EG-550192',
    taxNumber: 'EG-550-192-334',
    corporateSubtitle: 'Automotive Manufacturing & Assembly Lines',
    currency: 'EGP',
    factoryLocations: ['أبو رواش الجيزة تجميع الحافلات', 'مدينة السادات الصناعية لتصنيع السيارات', 'قليوب لقطع الغيار'],
    factoryGeofences: [
      { id: 'abu_rawash', name: 'Abu Rawash Bus Assembly', nameAr: 'أبو رواش الجيزة تجميع الحافلات', lat: 30.0520, lng: 31.0630, radiusMeters: 850 },
      { id: 'sadat', name: 'Sadat Auto Plant', nameAr: 'مدينة السادات الصناعية لتصنيع السيارات', lat: 30.3700, lng: 30.5200, radiusMeters: 700 },
    ],
    status: 'active',
  },
  tmg: {
    id: 'tmg',
    slug: 'tmg',
    name: 'Talaat Moustafa Group (TMG)',
    nameAr: 'مجموعة طلعت مصطفى',
    brand: {
      primaryColor: '#15803D', // Development Forest Green
      primaryLightColor: '#22C55E',
      primarySoftColor: '#F0FDF4',
      scaffoldBgColor: '#F9FAFB',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      supportHotline: '19688',
      crNumber: 'EG-993812',
      taxNumber: 'EG-993-812-776',
      corporateSubtitle: 'Urban Development & Smart Cities',
      currency: 'EGP',
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
    crNumber: 'EG-993812',
    taxNumber: 'EG-993-812-776',
    corporateSubtitle: 'Urban Development & Smart Cities',
    currency: 'EGP',
    factoryLocations: ['مدينتي - إدارة المرافق والتشغيل', 'مدينة نور - العاصمة الإدارية', 'الرحاب - الصيانة الحضرية'],
    factoryGeofences: [
      { id: 'madinaty', name: 'Madinaty Operations Hub', nameAr: 'مدينتي - إدارة المرافق والتشغيل', lat: 30.1080, lng: 31.6430, radiusMeters: 1000 },
      { id: 'capital_noor', name: 'Noor City Smart Infrastructure', nameAr: 'مدينة نور - العاصمة الإدارية', lat: 30.0200, lng: 31.7500, radiusMeters: 900 },
    ],
    status: 'active',
  },
  gulf_industrial: {
    id: 'gulf_industrial',
    slug: 'gulf_industrial',
    name: 'Gulf Industrial Corp',
    nameAr: 'الخليج للصناعات الهندسية',
    brand: {
      primaryColor: '#059669', // Industrial Emerald Green
      primaryLightColor: '#10B981',
      primarySoftColor: '#ECFDF5',
      scaffoldBgColor: '#F3F4F6',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      supportHotline: '80012345',
      crNumber: 'GCC-441092',
      taxNumber: 'SA-300-881-229',
      corporateSubtitle: 'Petrochemical & Heavy Machinery Plants',
      currency: 'SAR',
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
    crNumber: 'GCC-441092',
    taxNumber: 'SA-300-881-229',
    corporateSubtitle: 'Petrochemical & Heavy Machinery Plants',
    currency: 'SAR',
    factoryLocations: ['الجبيل الصناعية - مجمع البتروكيماويات', 'ينبع للخدمات الصناعية', 'الدمام اللوجستية'],
    factoryGeofences: [
      { id: 'jubail', name: 'Jubail Petrochemical Complex', nameAr: 'الجبيل الصناعية - مجمع البتروكيماويات', lat: 27.0110, lng: 49.6580, radiusMeters: 1200 },
      { id: 'yanbu', name: 'Yanbu Heavy Machinery', nameAr: 'ينبع للخدمات الصناعية', lat: 24.0900, lng: 38.0600, radiusMeters: 950 },
    ],
    status: 'active',
  },
  generic: {
    id: 'generic',
    slug: 'generic',
    name: 'PR Connect',
    nameAr: 'بي آر كونكت',
    brand: {
      primaryColor: '#1E40AF',
      primaryLightColor: '#2563EB',
      primarySoftColor: '#EFF6FF',
      scaffoldBgColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      localLogoAsset: 'assets/images/app_logo.png',
      supportHotline: '19000',
      crNumber: 'CR-100000',
      taxNumber: 'TAX-000-000-000',
      corporateSubtitle: 'Workforce & Operations Platform',
      currency: 'EGP',
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
    crNumber: 'CR-100000',
    taxNumber: 'TAX-000-000-000',
    corporateSubtitle: 'Workforce & Operations Platform',
    currency: 'EGP',
    factoryLocations: ['المقر الرئيسي', 'مجمع العمليات'],
    factoryGeofences: [
      { id: 'hq', name: 'Headquarters', nameAr: 'المقر الرئيسي', lat: 30.0444, lng: 31.2357, radiusMeters: 800 },
    ],
    status: 'active',
  },
  pr_connect: {
    id: 'pr_connect',
    slug: 'pr_connect',
    name: 'PR Connect',
    nameAr: 'بي آر كونكت',
    brand: {
      primaryColor: '#1E40AF',
      primaryLightColor: '#2563EB',
      primarySoftColor: '#EFF6FF',
      scaffoldBgColor: '#F8FAFC',
      surfaceColor: '#FFFFFF',
      logoUrl: null,
      localLogoAsset: 'assets/images/app_logo.png',
      supportHotline: '19000',
      crNumber: 'CR-100000',
      taxNumber: 'TAX-000-000-000',
      corporateSubtitle: 'Workforce & Operations Platform',
      currency: 'EGP',
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
    crNumber: 'CR-100000',
    taxNumber: 'TAX-000-000-000',
    corporateSubtitle: 'Workforce & Operations Platform',
    currency: 'EGP',
    factoryLocations: ['المقر الرئيسي', 'مجمع العمليات'],
    factoryGeofences: [
      { id: 'hq', name: 'Headquarters', nameAr: 'المقر الرئيسي', lat: 30.0444, lng: 31.2357, radiusMeters: 800 },
    ],
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

function findTenantBySlug(slug) {
  if (!slug) return null;
  const s = slug.toLowerCase().trim();
  const d = db();
  const dbTenants = d.tenants || [];
  const fromDb = dbTenants.find((t) => t.id === s || t.slug === s);
  if (fromDb) return fromDb;

  if (BUILTIN_TENANTS[s]) return BUILTIN_TENANTS[s];
  if (s === 'gulf' && BUILTIN_TENANTS.gulf_industrial) {
    return { ...BUILTIN_TENANTS.gulf_industrial, slug: 'gulf' };
  }
  const match = Object.values(BUILTIN_TENANTS).find((t) => t.slug === s || t.id === s);
  return match || null;
}

/**
 * GET /api/tenant/list and GET /api/tenants
 * Returns list of public active tenants for company onboarding discovery.
 */
router.get(['/tenants', '/tenant/list'], (req, res) => {
  const d = db();
  const dbTenants = (d.tenants || []).filter((t) => t.status === 'active');

  const all = [
    ...Object.values(BUILTIN_TENANTS),
    ...dbTenants.filter((dbT) => !BUILTIN_TENANTS[dbT.id]),
  ];

  res.json({
    success: true,
    tenants: all,
  });
});

/**
 * GET /api/tenants/:slug
 * Returns individual tenant metadata including branding, features, and geofences.
 */
router.get('/tenants/:slug', (req, res) => {
  const tenant = findTenantBySlug(req.params.slug);
  if (!tenant) {
    return res.status(404).json({ success: false, error: 'tenant_not_found' });
  }
  res.json({
    success: true,
    tenant,
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
router.get(['/super-admin/tenants', '/admin/tenants'], requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
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
router.post(['/super-admin/tenants', '/admin/tenants'], requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
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
    crNumber,
    taxNumber,
    corporateSubtitle,
    currency = 'EGP',
    factoryLocations = [],
    factoryGeofences = [],
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

  const finalCrNumber = crNumber || brand.crNumber || '104821';
  const finalTaxNumber = taxNumber || brand.taxNumber || 'EG-102-993-841';
  const finalSubtitle = corporateSubtitle || brand.corporateSubtitle || 'Workforce & Operations Management';
  const finalCurrency = currency || brand.currency || 'EGP';

  const newTenant = {
    id: cleanSlug,
    slug: cleanSlug,
    name: name.trim(),
    nameAr: (nameAr || name).trim(),
    crNumber: finalCrNumber,
    taxNumber: finalTaxNumber,
    corporateSubtitle: finalSubtitle,
    currency: finalCurrency,
    factoryLocations: Array.isArray(factoryLocations) ? factoryLocations : [],
    factoryGeofences: Array.isArray(factoryGeofences) ? factoryGeofences : [],
    brand: {
      primaryColor: brand.primaryColor || '#0B63B4',
      primaryLightColor: brand.primaryLightColor || '#1D7ED6',
      primarySoftColor: brand.primarySoftColor || '#E8F2FB',
      scaffoldBgColor: brand.scaffoldBgColor || '#F8F9FA',
      surfaceColor: brand.surfaceColor || '#FFFFFF',
      logoUrl: brand.logoUrl || null,
      supportHotline: brand.supportHotline || '19319',
      crNumber: finalCrNumber,
      taxNumber: finalTaxNumber,
      corporateSubtitle: finalSubtitle,
      currency: finalCurrency,
      factoryLocations: Array.isArray(factoryLocations) ? factoryLocations : [],
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
  auditService.recordAuditLog(d, {
    actor: req.admin?.sub || req.admin?.username || 'superadmin',
    role: req.admin?.role || 'superadmin',
    action: 'create_tenant',
    entity: 'tenant',
    entityId: newTenant.id,
    after: newTenant,
    details: `Provisioned new tenant organization: ${newTenant.name} (${newTenant.slug})`,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
    tenantId: newTenant.id,
  });
  save();

  try {
    realtimeService.broadcast('tenant:updated', {
      tenantId: newTenant.id,
      slug: newTenant.slug,
      name: newTenant.name,
      nameAr: newTenant.nameAr,
      brand: newTenant.brand,
      features: newTenant.features,
      authMode: newTenant.authMode,
      crNumber: newTenant.crNumber,
      taxNumber: newTenant.taxNumber,
      corporateSubtitle: newTenant.corporateSubtitle,
      currency: newTenant.currency,
      factoryLocations: newTenant.factoryLocations,
      factoryGeofences: newTenant.factoryGeofences,
    });
  } catch (_) {}

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
router.put(['/super-admin/tenants/:id', '/admin/tenants/:id'], requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
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

  const before = JSON.parse(JSON.stringify(tenant));

  const {
    name,
    nameAr,
    brand,
    features,
    authMode,
    status,
    smsProvider,
    smsSenderId,
    maxEmployees,
    crNumber,
    taxNumber,
    corporateSubtitle,
    currency,
    factoryLocations,
    factoryGeofences,
  } = req.body;

  if (name) tenant.name = name.trim();
  if (nameAr) tenant.nameAr = nameAr.trim();
  if (authMode) tenant.authMode = authMode;
  if (status) tenant.status = status;
  if (smsProvider) tenant.smsProvider = smsProvider;
  if (smsSenderId) tenant.smsSenderId = smsSenderId;
  if (maxEmployees !== undefined) tenant.maxEmployees = parseInt(maxEmployees, 10);
  if (crNumber !== undefined) tenant.crNumber = crNumber;
  if (taxNumber !== undefined) tenant.taxNumber = taxNumber;
  if (corporateSubtitle !== undefined) tenant.corporateSubtitle = corporateSubtitle;
  if (currency !== undefined) tenant.currency = currency;
  if (factoryLocations !== undefined && Array.isArray(factoryLocations)) tenant.factoryLocations = factoryLocations;
  if (factoryGeofences !== undefined && Array.isArray(factoryGeofences)) tenant.factoryGeofences = factoryGeofences;

  if (brand && typeof brand === 'object') {
    tenant.brand = {
      ...tenant.brand,
      ...brand,
      crNumber: tenant.crNumber || brand.crNumber || tenant.brand?.crNumber,
      taxNumber: tenant.taxNumber || brand.taxNumber || tenant.brand?.taxNumber,
      corporateSubtitle: tenant.corporateSubtitle || brand.corporateSubtitle || tenant.brand?.corporateSubtitle,
      currency: tenant.currency || brand.currency || tenant.brand?.currency,
      factoryLocations: tenant.factoryLocations || brand.factoryLocations || tenant.brand?.factoryLocations,
    };
  }

  if (features && typeof features === 'object') {
    tenant.features = { ...tenant.features, ...features };
  }

  tenant.updatedAt = new Date().toISOString();
  auditService.recordAuditLog(d, {
    actor: req.admin?.sub || req.admin?.username || 'superadmin',
    role: req.admin?.role || 'superadmin',
    action: 'update_tenant',
    entity: 'tenant',
    entityId: tenant.id,
    before,
    after: tenant,
    details: `Updated configuration for tenant: ${tenant.name} (${tenant.id})`,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
    tenantId: tenant.id,
  });
  save();

  try {
    realtimeService.broadcast('tenant:updated', {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      nameAr: tenant.nameAr,
      brand: tenant.brand,
      features: tenant.features,
      authMode: tenant.authMode,
      crNumber: tenant.crNumber,
      taxNumber: tenant.taxNumber,
      corporateSubtitle: tenant.corporateSubtitle,
      currency: tenant.currency,
      factoryLocations: tenant.factoryLocations,
      factoryGeofences: tenant.factoryGeofences,
    });
  } catch (_) {}

  res.json({
    success: true,
    message: 'tenant_updated_successfully',
    tenant,
  });
});

/**
 * POST /api/super-admin/tenants/:id/logo
 * Update brand logo URL for a tenant and broadcast live.
 */
router.post(['/super-admin/tenants/:id/logo', '/admin/tenants/:id/logo'], requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
  const targetId = req.params.id.trim().toLowerCase();
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

  const { logoUrl } = req.body || {};
  if (!logoUrl) {
    return res.status(400).json({ error: 'logo_url_required' });
  }

  const previousLogo = tenant.brand?.logoUrl || null;
  tenant.brand = tenant.brand || {};
  tenant.brand.logoUrl = logoUrl;
  tenant.updatedAt = new Date().toISOString();
  auditService.recordAuditLog(d, {
    actor: req.admin?.sub || req.admin?.username || 'superadmin',
    role: req.admin?.role || 'superadmin',
    action: 'update_tenant_logo',
    entity: 'tenant',
    entityId: tenant.id,
    before: { logoUrl: previousLogo },
    after: { logoUrl },
    details: `Updated brand logo for tenant: ${tenant.name} (${tenant.id})`,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
    tenantId: tenant.id,
  });
  save();

  try {
    realtimeService.broadcast('tenant:updated', {
      tenantId: tenant.id,
      slug: tenant.slug,
      name: tenant.name,
      nameAr: tenant.nameAr,
      brand: tenant.brand,
      features: tenant.features,
    });
  } catch (_) {}

  res.json({
    success: true,
    message: 'logo_updated_successfully',
    logoUrl,
    tenant,
  });
});

/**
 * DELETE /api/super-admin/tenants/:id
 * Soft-deactivates tenant (marks status as 'inactive').
 */
router.delete(['/super-admin/tenants/:id', '/admin/tenants/:id'], requireAdmin, requireRole(ROLES.SUPER_ADMIN), (req, res) => {
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
  auditService.recordAuditLog(d, {
    actor: req.admin?.sub || req.admin?.username || 'superadmin',
    role: req.admin?.role || 'superadmin',
    action: 'deactivate_tenant',
    entity: 'tenant',
    entityId: tenant.id,
    before: { status: 'active' },
    after: { status: 'inactive' },
    details: `Deactivated tenant organization: ${tenant.name} (${tenant.id})`,
    ip: req.ip,
    userAgent: req.headers?.['user-agent'] || null,
    tenantId: tenant.id,
  });
  save();

  res.json({
    success: true,
    message: 'tenant_deactivated_successfully',
    tenantId: targetId,
  });
});

router.BUILTIN_TENANTS = BUILTIN_TENANTS;
module.exports = router;
module.exports.BUILTIN_TENANTS = BUILTIN_TENANTS;
