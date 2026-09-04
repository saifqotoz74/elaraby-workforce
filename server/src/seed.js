// First-run seed matching the app's demo identity so the emulator flow works
// end-to-end out of the box.
const { hash } = require('./auth');

function seed(db) {
  if (db.employees.length > 0) return;

  db.employees.push({
    id: 'emp_1',
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
    active: true,
    createdAt: Date.now(),
  });
  db.employees.push({
    id: 'emp_2',
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
    createdAt: Date.now(),
  });

  db.announcements.push({
    id: 'ann_1',
    title: 'New Shift Policy Starting from 10 August 2026',
    body:
      'All company bus routes and timing will synchronize 30 minutes before shifts start. ' +
      'Please review the updated schedule with your line manager and plan your commute accordingly.',
    important: true,
    createdAt: Date.now(),
  });
  db.news.push({
    id: 'news_1',
    title: 'Factory 2 Expansion Completed',
    body: 'The new production hall is now operational and adds 120 new roles across three lines.',
    createdAt: Date.now(),
  });
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

  console.log('[seed] database seeded (2 employees, demo content)');
}

module.exports = { seed };
