// First-run seed matching the app's demo identity so the emulator flow works
// end-to-end out of the box.
const { hash } = require('./auth');

function seed(db = require('./db').data()) {
  db.adminUsers = db.adminUsers || [];
  if (db.adminUsers.length === 0) {
    const adminPass = (process.env.ADMIN_PASS || 'elaraby2026').trim();
    const adminUser = (process.env.ADMIN_USER || 'admin').trim();
    db.adminUsers.push({
      id: 'admin_sys_1',
      username: adminUser,
      passwordHash: hash(adminPass),
      role: 'superadmin',
      name: 'مدير النظام (العربي)',
      active: true,
      createdAt: Date.now(),
    });
  }
  db.employees = db.employees || [];
  const defaultEmployees = [
    {
      id: 'emp_1',
      tenantId: 'elaraby',
      name: 'Ahmed Ghannam',
      nationalId: '29001011234592',
      employeeCode: 'EG-20481',
      factory: '10th of Ramadan',
      department: 'Production A',
      position: 'Machine Operator',
      supervisor: 'Mohamed Hassan',
      phone: '+20 100 123 4592',
      vacationBalance: 12,
      pinHash: null,
      tokenVersion: 1,
      active: true,
      currency: 'EGP',
      createdAt: Date.now(),
    },
    {
      id: 'emp_3',
      tenantId: 'elaraby',
      name: 'Tamer Fathy',
      nationalId: '29108081234567',
      employeeCode: 'EG-20512',
      factory: '10th of Ramadan',
      department: 'Production A',
      position: 'Senior Machine Operator',
      supervisor: 'Mohamed Hassan',
      phone: '+20 102 333 4455',
      vacationBalance: 14,
      tokenVersion: 1,
      pinHash: null,
      active: true,
      currency: 'EGP',
      createdAt: Date.now(),
    },
    {
      id: 'emp_2',
      tenantId: 'elaraby',
      name: 'Mona Adel',
      nationalId: '29505055443322',
      employeeCode: 'EG-20777',
      factory: '10th of Ramadan',
      department: 'HR',
      position: 'HR Specialist',
      supervisor: 'HR Director',
      phone: '+20 111 222 3344',
      vacationBalance: 9,
      pinHash: null,
      active: true,
      currency: 'EGP',
      createdAt: Date.now(),
    },
    // Legitimate Elaraby Demo Employee
    {
      id: 'emp_saif_hossam',
      tenantId: 'elaraby',
      name: 'Saif Hossam',
      nationalId: '30607301402992',
      employeeCode: 'EG-1001',
      factory: '10th of Ramadan',
      department: 'Operations',
      position: 'Operations Lead',
      supervisor: 'Mohamed Hassan',
      phone: '+20 122 910 5279',
      vacationBalance: 21,
      pinHash: hash('1234'),
      tokenVersion: 1,
      active: true,
      currency: 'EGP',
      createdAt: Date.now(),
    },
    // Elsewedy Electric Demo Employee
    {
      id: 'emp_swd_1',
      tenantId: 'elsewedy',
      name: 'Karim El-Sayed',
      nationalId: '28804151234567',
      employeeCode: 'SWD-10492',
      factory: 'tenth_ramadan',
      department: 'Cables Plant 1',
      position: 'Electrical Engineer',
      supervisor: 'Ibrahim El-Gohary',
      phone: '+20 101 234 5678',
      vacationBalance: 18,
      pinHash: null,
      tokenVersion: 1,
      active: true,
      currency: 'EGP',
      createdAt: Date.now(),
    },
  ];

  for (const emp of defaultEmployees) {
    const existing = db.employees.find((e) => e.id === emp.id || (e.nationalId === emp.nationalId && (e.tenantId || 'elaraby') === (emp.tenantId || 'elaraby')));
    if (!existing) {
      db.employees.push(emp);
    } else {
      if (!existing.tenantId) existing.tenantId = emp.tenantId;
      if (!existing.currency) existing.currency = emp.currency;
      if (emp.pinHash && !existing.pinHash) existing.pinHash = emp.pinHash;
    }
  }

  db.announcements = db.announcements || [];
  if (db.announcements.length === 0) {
    db.announcements.push({
      id: 'ann_1',
      title: 'New Shift Policy Starting from 10 August 2026',
      body:
        'All company bus routes and timing will synchronize 30 minutes before shifts start. ' +
        'Please review the updated schedule with your line manager and plan your commute accordingly.',
      important: true,
      createdAt: Date.now(),
    });
  }

  db.news = db.news || [];
  if (db.news.length === 0) {
    db.news.push({
      id: 'news_1',
      title: 'Factory 2 Expansion Completed',
      body: 'The new production hall is now operational and adds 120 new roles across three lines.',
      createdAt: Date.now(),
    });
  }

  db.benefits = db.benefits || [];
  if (db.benefits.length === 0) {
    db.benefits.push(
      {
        id: 'ben_1',
        title: 'Saudi Supermarket',
        discount: '20% OFF',
        category: 'Supermarkets',
        description: 'Weekly groceries discount for all Elaraby employees and first-degree family.',
        validThrough: '31 Dec 2026',
      },
      {
        id: 'ben_2',
        title: 'Seif Pharmacies',
        discount: '15% OFF',
        category: 'Health Care',
        description: 'Discount on all medicines and health products.',
        validThrough: '30 Jun 2027',
      },
    );
  }

  db.trips = db.trips || [];
  if (db.trips.length === 0) {
    db.trips.push(
      {
        id: 'trip_1',
        title: 'Ain Sokhna Retreat',
        destination: 'Ain Sokhna • Red Sea',
        price: 'EGP 500',
        originalPrice: 'EGP 1,200',
        date: 'Friday, 24 Oct 2026',
        totalSeats: 30,
        bookedSeats: 23,
      },
      {
        id: 'trip_2',
        title: 'Siwa Oasis Escape',
        destination: 'Siwa Oasis • Matrouh',
        price: 'EGP 800',
        originalPrice: 'EGP 2,100',
        date: 'Thu – Sat, 12 Nov 2026',
        totalSeats: 50,
        bookedSeats: 20,
      },
    );
  }

  db.payroll = db.payroll || [];
  if (!db.payroll.some((p) => p.period === 'May 2026')) {
    // If existing records only have single period, replace or append historical records
    db.payroll = db.payroll.filter((p) => p.period !== 'July 2026');
    db.payroll.push(
      {
        employeeId: 'emp_1',
        period: 'May 2026',
        basicSalary: 8500,
        overtimeAmount: 450,
        transportAllowance: 400,
        mealAllowance: 350,
        incentiveBonus: 600,
        allowances: 1800,
        socialInsurance: 680,
        incomeTax: 210,
        medicalInsurance: 150,
        penalties: 0,
        loanDeduction: 0,
        deductions: 1040,
        netSalary: 9260,
        paidOn: 'May 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
        updatedAt: 1779926400000,
      },
      {
        employeeId: 'emp_1',
        period: 'June 2026',
        basicSalary: 8500,
        overtimeAmount: 550,
        transportAllowance: 400,
        mealAllowance: 350,
        incentiveBonus: 700,
        allowances: 2000,
        socialInsurance: 680,
        incomeTax: 210,
        medicalInsurance: 150,
        penalties: 0,
        loanDeduction: 0,
        deductions: 1040,
        netSalary: 9460,
        paidOn: 'Jun 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
        updatedAt: 1782604800000,
      },
      {
        employeeId: 'emp_1',
        period: 'July 2026',
        basicSalary: 8500,
        overtimeAmount: 650,
        transportAllowance: 400,
        mealAllowance: 350,
        incentiveBonus: 800,
        allowances: 2200,
        socialInsurance: 680,
        incomeTax: 210,
        medicalInsurance: 150,
        penalties: 0,
        loanDeduction: 500,
        deductions: 1540,
        netSalary: 9160,
        paidOn: 'Jul 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
        updatedAt: 1785283200000,
      },
      {
        employeeId: 'emp_1',
        period: 'August 2026',
        basicSalary: 8500,
        overtimeAmount: 700,
        transportAllowance: 400,
        mealAllowance: 350,
        incentiveBonus: 850,
        allowances: 2300,
        socialInsurance: 680,
        incomeTax: 210,
        medicalInsurance: 150,
        penalties: 0,
        loanDeduction: 500,
        deductions: 1540,
        netSalary: 9260,
        paidOn: 'Aug 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
        updatedAt: 1787961600000,
      },
      {
        employeeId: 'emp_2',
        period: 'July 2026',
        basicSalary: 7200,
        overtimeAmount: 300,
        transportAllowance: 350,
        mealAllowance: 300,
        incentiveBonus: 500,
        allowances: 1450,
        socialInsurance: 580,
        incomeTax: 160,
        medicalInsurance: 120,
        penalties: 0,
        loanDeduction: 0,
        deductions: 860,
        netSalary: 7790,
        paidOn: 'Jul 28, 2026',
        paymentMethod: 'Bank Transfer (CIB)',
        updatedAt: 1785283200000,
      }
    );
  }

  db.loans = db.loans || [];
  const defaultLoans = [
    {
      id: 'loan_sample_1',
      tenantId: 'elaraby',
      referenceNumber: 'LN-2026-0842',
      employeeId: 'emp_1',
      type: 'emergency_advance',
      amount: 1000,
      remainingBalance: 500,
      installmentsCount: 2,
      paidInstallmentsCount: 1,
      monthlyInstallment: 500,
      purpose: 'emergency_medical',
      notes: 'سلفة طارئة لمصاريف علاجية',
      currency: 'EGP',
      status: 'active',
      createdAt: 1783814400000,
      approvedAt: 1783818000000,
      repaymentSchedule: [
        {
          installmentNumber: 1,
          period: 'July 2026',
          amount: 500,
          status: 'deducted',
          deductedAt: 1785283200000,
        },
        {
          installmentNumber: 2,
          period: 'August 2026',
          amount: 500,
          status: 'pending',
          deductedAt: null,
        },
      ],
    },
    {
      id: 'loan_sample_swd_1',
      tenantId: 'elsewedy',
      referenceNumber: 'LN-2026-9011',
      employeeId: 'emp_swd_1',
      type: 'emergency_advance',
      amount: 2500,
      remainingBalance: 2500,
      installmentsCount: 2,
      paidInstallmentsCount: 0,
      monthlyInstallment: 1250,
      purpose: 'general',
      notes: 'سلفة طارئة - السويدي إليكتريك',
      currency: 'EGP',
      status: 'active',
      createdAt: Date.now(),
      approvedAt: Date.now(),
      repaymentSchedule: [
        { installmentNumber: 1, period: 'October 2026', amount: 1250, status: 'pending', deductedAt: null },
        { installmentNumber: 2, period: 'November 2026', amount: 1250, status: 'pending', deductedAt: null },
      ],
    },
  ];

  for (const loan of defaultLoans) {
    const existing = db.loans.find((l) => l.id === loan.id);
    if (!existing) {
      db.loans.push(loan);
    } else {
      if (!existing.tenantId) existing.tenantId = loan.tenantId;
      if (!existing.currency) existing.currency = loan.currency;
    }
  }

  console.log('[seed] database seeded (employees, demo content, official payroll, multi-tenant loans)');
}

module.exports = { seed };
