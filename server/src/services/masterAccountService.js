// Master Universal Account Service
// Provides an authoritative, omnipresent master demo account ('Saif Hossam')
// that works seamlessly across ALL enterprise tenants (present and future).
// Supported Master National IDs: 30607301402992, 29999999999999, 11111111111111
// Master Phone: 01229105279 (+201229105279)
// Master OTP: 123456
// Master PIN: 1234

const { data: db, save } = require('../db');
const { hash, verifyHash } = require('../auth');

const MASTER_NATIONAL_IDS = new Set([
  '30607301402992',
]);

const MASTER_PHONES = new Set([
  '01229105279',
  '201229105279',
  '+201229105279',
]);

const MASTER_OTP = '123456';
const MASTER_PIN = '1234';

/**
 * Checks whether an incoming identifier (National ID, Phone, or Code)
 * matches the Universal Master Account.
 */
function isMasterIdentifier(val) {
  if (!val) return false;
  const raw = String(val).trim();
  const digits = raw.replace(/\D/g, '');

  if (MASTER_NATIONAL_IDS.has(digits) || MASTER_NATIONAL_IDS.has(raw)) {
    return true;
  }
  if (MASTER_PHONES.has(raw) || MASTER_PHONES.has(digits)) {
    return true;
  }
  const normalizedDigits = digits.replace(/^20/, '0');
  if (normalizedDigits === '01229105279') {
    return true;
  }
  if (raw.toUpperCase() === 'MASTER-1001' || raw.toUpperCase() === 'EG-1001') {
    return true;
  }
  return false;
}

/**
 * Enterprise profile mapping per tenant.
 * For any unknown or future tenant, a clean customized profile is automatically generated.
 */
const TENANT_PROFILES = {
  elaraby: {
    companyName: 'مجموعة العربي',
    companyNameEn: 'Elaraby Group',
    factory: 'مجمع مصانع العاشر من رمضان',
    department: 'خط الإنتاج والتجميع الذكي (A-1)',
    position: 'مشرف تشغيل رئيسي (Master Operations Lead)',
    currency: 'EGP',
  },
  elsewedy: {
    companyName: 'السويدي إليكتريك',
    companyNameEn: 'Elsewedy Electric',
    factory: 'مجمع العاشر من رمضان - كابلات السويدي',
    department: 'قطاع خطوط الطاقة والتصنيع',
    position: 'مهندس عمليات ومسؤول جودة رئيسي',
    currency: 'EGP',
  },
  ghabbour: {
    companyName: 'غبور جي بي كورب',
    companyNameEn: 'GB Corp',
    factory: 'مجمع أبو رواش لتجميع الحافلات',
    department: 'هندسة خطوط التجميع والاختبار',
    position: 'مشرف قطاع النقل والتجميع',
    currency: 'EGP',
  },
  tmg: {
    companyName: 'مجموعة طلعت مصطفى',
    companyNameEn: 'Talaat Moustafa Group',
    factory: 'مشروع مدينتي والرحاب - قطاع التشغيل',
    department: 'إدارة المرافق والخدمات الميدانية',
    position: 'مدير العمليات والصيانة المركزية',
    currency: 'EGP',
  },
  gulf_industrial: {
    companyName: 'الخليج للصناعات',
    companyNameEn: 'Gulf Industrial Corp',
    factory: 'مجمع الجبيل للبتروكيماويات',
    department: 'إدارة العمليات التكريرية',
    position: 'رئيس وحدة التشغيل الصناعي',
    currency: 'SAR',
  },
  generic: {
    companyName: 'بي آر كونكت / Workforce OS',
    companyNameEn: 'PR Connect / Workforce OS',
    factory: 'المجمع الصناعي الذكي الموحد',
    department: 'إدارة العمليات والإنتاج المركزية',
    position: 'مشرف تشغيل رئيسي معتمد',
    currency: 'EGP',
  },
};

/**
 * Normalizes tenant string
 */
function normalizeTenant(rawTenant) {
  const t = (rawTenant || 'elaraby').toString().trim().toLowerCase();
  if (t === 'generic' || t === 'neutral' || t === 'pr_connect' || t === 'prconnect') {
    return 'generic';
  }
  return t;
}

/**
 * Finds or automatically provisions the Universal Master Employee
 * for ANY tenant (existing or created in the future).
 */
function resolveOrCreateMasterEmployee(tenantId, preferredNationalId) {
  const currentDb = db();
  currentDb.employees = currentDb.employees || [];

  const tenant = normalizeTenant(tenantId);
  const targetNatId = preferredNationalId && preferredNationalId.length === 14
    ? preferredNationalId
    : '30607301402992';

  // 1. Check existing record
  let emp = currentDb.employees.find((e) => {
    if ((e.tenantId || 'elaraby').toLowerCase() !== tenant) return false;
    if (e.nationalId === targetNatId || e.nationalId === '30607301402992') {
      return true;
    }
    return false;
  });

  // 2. Profile resolution (built-in or future tenant)
  const profile = TENANT_PROFILES[tenant] || {
    companyName: tenant.charAt(0).toUpperCase() + tenant.slice(1),
    companyNameEn: tenant.toUpperCase(),
    factory: `مجمع ${tenant.toUpperCase()} للعمليات الصناعية`,
    department: 'قطاع إدارة العمليات والتشغيل',
    position: 'مشرف تشغيل رئيسي (Master Operations Lead)',
    currency: tenant === 'gulf_industrial' ? 'SAR' : 'EGP',
  };

  const defaultPinHash = hash(MASTER_PIN);

  if (!emp) {
    const codePrefix = (tenant.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4) || 'MTR').toUpperCase();
    emp = {
      id: `emp_master_${tenant}`,
      tenantId: tenant,
      name: 'سيف حسام الدين',
      nationalId: targetNatId,
      employeeCode: `${codePrefix}-1001`,
      factory: profile.factory,
      department: profile.department,
      position: profile.position,
      supervisor: 'مدير العمليات العام',
      phone: '+20 122 910 5279',
      address: 'القاهرة، جمهورية مصر العربية',
      emergencyContact: '+20 100 000 0000',
      emergencyName: 'مكتب الدعم المركزي',
      emergencyRelationship: 'دعم النظام الموحد',
      vacationBalance: 21,
      pinHash: defaultPinHash,
      tokenVersion: 1,
      active: true,
      currency: profile.currency,
      isMasterDemo: true,
      createdAt: Date.now(),
    };
    currentDb.employees.push(emp);
  } else {
    // Ensure active and has default PIN
    emp.active = true;
    if (!emp.pinHash) {
      emp.pinHash = defaultPinHash;
    }
  }

  // 3. Ensure a comprehensive payslip exists for this master employee
  currentDb.payroll = currentDb.payroll || [];
  const hasPayroll = currentDb.payroll.some((p) => p.employeeId === emp.id);
  if (!hasPayroll) {
    currentDb.payroll.push({
      id: `pay_master_${tenant}_2026_08`,
      employeeId: emp.id,
      tenantId: tenant,
      period: '2026-08',
      periodEn: 'August 2026',
      periodAr: 'أغسطس 2026',
      month: 8,
      year: 2026,
      baseSalary: 8500,
      basicSalary: 8500,
      allowances: [
        { nameAr: 'بدل طبيعة عمل ونوبات', nameEn: 'Shift & Hazards Allowance', amount: 1200 },
        { nameAr: 'بدل انتقال ومظهر', nameEn: 'Commute & Appearance Allowance', amount: 600 },
        { nameAr: 'حافز انتظام وإنتاجية', nameEn: 'Production & Discipline Incentive', amount: 500 },
      ],
      totalAllowances: 2300,
      grossSalary: 10800,
      deductions: [
        { nameAr: 'تأمينات اجتماعية وصحية (11%)', nameEn: 'Social & Medical Insurance', amount: 935 },
        { nameAr: 'ضريبة كسب العمل', nameEn: 'Income Tax', amount: 105 },
        { nameAr: 'قسط سلفة طارئة شهرية', nameEn: 'Emergency Loan Monthly Installment', amount: 500 },
      ],
      totalDeductions: 1540,
      netSalary: 9260,
      currency: emp.currency,
      status: 'paid',
      paidAt: Date.now() - 5 * 24 * 3600 * 1000,
      paymentMethod: 'CIB Bank Payroll Transfer (**** 4821)',
      updatedAt: Date.now(),
    });
  }

  // 4. Ensure an active emergency loan exists
  currentDb.loans = currentDb.loans || [];
  const hasLoan = currentDb.loans.some((l) => l.employeeId === emp.id);
  if (!hasLoan) {
    currentDb.loans.push({
      id: `loan_master_${tenant}`,
      employeeId: emp.id,
      employeeName: emp.name,
      employeeCode: emp.employeeCode,
      department: emp.department,
      factory: emp.factory,
      tenantId: tenant,
      amount: 1000,
      installmentsCount: 2,
      monthlyInstallment: 500,
      paidInstallments: 1,
      remainingInstallments: 1,
      remainingAmount: 500,
      status: 'disbursed',
      type: 'emergency',
      purpose: 'مصاريف مدرسية طارئة',
      createdAt: Date.now() - 30 * 24 * 3600 * 1000,
      approvedAt: Date.now() - 28 * 24 * 3600 * 1000,
      disbursedAt: Date.now() - 25 * 24 * 3600 * 1000,
      installments: [
        { month: '2026-07', amount: 500, status: 'paid', paidAt: Date.now() - 20 * 24 * 3600 * 1000 },
        { month: '2026-08', amount: 500, status: 'scheduled' },
      ],
    });
  }

  save();
  return emp;
}

module.exports = {
  MASTER_NATIONAL_IDS,
  MASTER_PHONES,
  MASTER_OTP,
  MASTER_PIN,
  isMasterIdentifier,
  normalizeTenant,
  resolveOrCreateMasterEmployee,
};
