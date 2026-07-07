import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const employeeRoles = [
  'Sudor',
  'Vopsitor',
  'Șofer',
  'Lăcătuș mecanic',
  'Muncitor necalificat',
  'Administrativ',
];

const activities = [
  { name: 'Debitare (inclusiv CNC intern)', color: '#3B7EA1' },
  { name: 'Asamblare', color: '#7A8450' },
  { name: 'Sudare', color: '#B5533C' },
  { name: 'Vopsire', color: '#8E5FA8' },
  { name: 'Rectificare', color: '#6B6B6B' },
  { name: 'Premontaj/Montaj', color: '#C9A227' },
  { name: 'Administrativ', color: '#8A8A8A' },
  { name: 'CNC extern', color: '#2F6F4E' },
] as const;

// Stable IDs for seed Person placeholders — never change across re-seeds.
const ADMIN_PERSON_ID = '00000000-0000-0000-0000-000000000001';
const EMPLOYEE_PERSON_ID = '00000000-0000-0000-0000-000000000002';

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_SEED_EMAIL;
  const adminPassword = process.env.ADMIN_SEED_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.log('ADMIN_SEED_EMAIL or ADMIN_SEED_PASSWORD not set — skipping admin user seed.');
    return;
  }

  console.log('Seeding admin User...');

  const adminPerson = await prisma.person.upsert({
    where: { id: ADMIN_PERSON_ID },
    update: {},
    create: {
      id: ADMIN_PERSON_ID,
      firstName: 'Admin',
      lastName: 'User',
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (existing) {
    console.log(`  ↩ Admin user already exists: ${existing.email} (${existing.id}) — skipped.`);
    return;
  }

  const passwordHash = await bcrypt.hash(adminPassword, 12);
  const adminUser = await prisma.user.create({
    data: {
      email: adminEmail,
      passwordHash,
      role: 'ADMIN',
      personId: adminPerson.id,
    },
  });

  console.log(`  ✓ Admin user created: ${adminUser.email} (${adminUser.id})`);
}

async function seedEmployeeUser() {
  const employeeEmail = process.env.EMPLOYEE_SEED_EMAIL;
  const employeePassword = process.env.EMPLOYEE_SEED_PASSWORD;

  if (!employeeEmail || !employeePassword) {
    console.log('EMPLOYEE_SEED_EMAIL or EMPLOYEE_SEED_PASSWORD not set — skipping employee user seed.');
    return;
  }

  console.log('Seeding employee User...');

  const employeePerson = await prisma.person.upsert({
    where: { id: EMPLOYEE_PERSON_ID },
    update: {},
    create: {
      id: EMPLOYEE_PERSON_ID,
      firstName: 'Ion',
      lastName: 'Popescu',
    },
  });

  const existing = await prisma.user.findUnique({ where: { email: employeeEmail } });
  if (existing) {
    console.log(`  ↩ Employee user already exists: ${existing.email} (${existing.id}) — skipped.`);
    return;
  }

  const passwordHash = await bcrypt.hash(employeePassword, 12);
  const employeeUser = await prisma.user.create({
    data: {
      email: employeeEmail,
      passwordHash,
      role: 'EMPLOYEE',
      personId: employeePerson.id,
    },
  });

  console.log(`  ✓ Employee user created: ${employeeUser.email} (${employeeUser.id})`);
}

// ---------------------------------------------------------------------------
// Demo / test data — Companies, Projects, Person+User pairs
// ---------------------------------------------------------------------------

const COMPANY_IDS = {
  agromec: 'c0000000-0000-0000-0000-000000000001',
  metalexport: 'c0000000-0000-0000-0000-000000000002',
  lidl: 'c0000000-0000-0000-0000-000000000003',
  steelcor: 'c0000000-0000-0000-0000-000000000004',
  dacia: 'c0000000-0000-0000-0000-000000000005',
} as const;

const companiesSeed = [
  {
    id: COMPANY_IDS.agromec,
    name: 'Agromec SRL',
    taxCode: 'RO18234455',
    tradeRegistryNumber: 'J32/1122/2015',
    registeredAddress: 'Str. Industriilor nr. 12, Zalău, Sălaj',
    phone: '0741223344',
    email: 'contact@agromec.ro',
    legalRepresentative: 'Ion Vasilescu',
    contactPerson: 'Ion Vasilescu',
    contactPersonPhone: '0741223344',
    color: '#7A8450',
  },
  {
    id: COMPANY_IDS.metalexport,
    name: 'Metalexport SA',
    taxCode: 'RO9012233',
    tradeRegistryNumber: 'J12/3344/2010',
    registeredAddress: 'Bd. Metalurgiei nr. 5, Cluj-Napoca',
    phone: '0755667889',
    email: 'office@metalexport.ro',
    legalRepresentative: 'Elena Popa',
    contactPerson: 'Elena Popa',
    contactPersonPhone: '0755667889',
    color: '#3B7EA1',
  },
  {
    id: COMPANY_IDS.lidl,
    name: 'Lidl România',
    taxCode: 'RO7788990',
    tradeRegistryNumber: 'J40/5566/2008',
    registeredAddress: 'Șos. Virtuții nr. 148, București',
    phone: '0212334556',
    email: 'achizitii@lidl.ro',
    legalRepresentative: 'Andrei Marin',
    contactPerson: 'Andrei Marin',
    contactPersonPhone: '0212334556',
    color: '#C9A227',
  },
  {
    id: COMPANY_IDS.steelcor,
    name: 'Steelcor Invest',
    taxCode: 'RO3344556',
    tradeRegistryNumber: 'J24/7788/2012',
    registeredAddress: 'Str. Oțelarilor nr. 3, Reșița',
    phone: '0729112233',
    email: 'contact@steelcor.ro',
    legalRepresentative: 'Sorina Dumitru',
    contactPerson: 'Sorina Dumitru',
    contactPersonPhone: '0729112233',
    color: '#6B6B6B',
  },
  {
    id: COMPANY_IDS.dacia,
    name: 'Dacia Groupe',
    taxCode: 'RO4455667',
    tradeRegistryNumber: 'J31/9900/2011',
    registeredAddress: 'Str. Uzinei nr. 1, Mioveni, Argeș',
    phone: '0261445778',
    email: 'furnizori@daciagroupe.ro',
    legalRepresentative: 'Radu Constantin',
    contactPerson: 'Radu Constantin',
    contactPersonPhone: '0261445778',
    color: '#B5533C',
  },
] as const;

const projectsSeed = [
  {
    code: 'PRJ-0001',
    name: 'Hală depozitare',
    companyId: COMPANY_IDS.agromec,
    status: 'IN_PRODUCTIE' as const,
    dueDate: new Date('2026-07-15'),
    readyForExecution: true,
    color: '#C9A227',
  },
  {
    code: 'PRJ-0003',
    name: 'Structură hală',
    companyId: COMPANY_IDS.metalexport,
    status: 'CASTIGAT' as const,
    dueDate: new Date('2026-08-20'),
    readyForExecution: false,
    color: '#7A8450',
  },
  {
    code: 'PRJ-0004',
    name: 'Copertină acces',
    companyId: COMPANY_IDS.lidl,
    status: 'PREGATIT_LIVRARE' as const,
    dueDate: new Date('2026-07-10'),
    readyForExecution: true,
    color: '#B5533C',
  },
  {
    code: 'PRJ-0005',
    name: 'Balustrade industriale',
    companyId: COMPANY_IDS.steelcor,
    status: 'LIVRAT' as const,
    dueDate: new Date('2026-07-01'),
    readyForExecution: true,
    color: '#6B6B6B',
  },
  {
    code: 'PRJ-0008',
    name: 'Grindă macara uzină',
    companyId: COMPANY_IDS.dacia,
    status: 'FINALIZAT' as const,
    dueDate: new Date('2026-06-25'),
    readyForExecution: true,
    color: '#2F6F4E',
  },
] as const;

const employeePairsSeed = [
  {
    personId: 'p0000000-0000-0000-0000-000000000001',
    firstName: 'Ion',
    lastName: 'Popescu',
    employeeRoleName: 'Sudor',
    email: 'ion.popescu@fabxpert.ro',
    isActive: true,
  },
  {
    personId: 'p0000000-0000-0000-0000-000000000002',
    firstName: 'Vasile',
    lastName: 'Ionescu',
    employeeRoleName: 'Vopsitor',
    email: 'vasile.ionescu@fabxpert.ro',
    isActive: true,
  },
  {
    personId: 'p0000000-0000-0000-0000-000000000003',
    firstName: 'Andrei',
    lastName: 'Marin',
    employeeRoleName: 'Șofer',
    email: 'andrei.marin@fabxpert.ro',
    isActive: true,
  },
  {
    personId: 'p0000000-0000-0000-0000-000000000004',
    firstName: 'Mihai',
    lastName: 'Dumitrescu',
    employeeRoleName: 'Lăcătuș mecanic',
    email: 'mihai.dumitrescu@fabxpert.ro',
    isActive: true,
  },
  {
    personId: 'p0000000-0000-0000-0000-000000000005',
    firstName: 'Elena',
    lastName: 'Radu',
    employeeRoleName: 'Administrativ',
    email: 'elena.radu@fabxpert.ro',
    isActive: false,
  },
] as const;

async function requireEmployeeRoleId(name: string): Promise<string> {
  const role = await prisma.employeeRole.findUnique({ where: { name } });
  if (!role) {
    throw new Error(
      `EmployeeRole "${name}" not found — run the EmployeeRole seed step first.`,
    );
  }
  return role.id;
}

async function seedCompanies() {
  console.log('Seeding Companies...');
  for (const company of companiesSeed) {
    const row = await prisma.company.upsert({
      where: { id: company.id },
      update: {
        name: company.name,
        taxCode: company.taxCode,
        tradeRegistryNumber: company.tradeRegistryNumber,
        registeredAddress: company.registeredAddress,
        phone: company.phone,
        email: company.email,
        legalRepresentative: company.legalRepresentative,
        contactPerson: company.contactPerson,
        contactPersonPhone: company.contactPersonPhone,
        color: company.color,
      },
      create: { ...company },
    });
    console.log(`  ✓ ${row.name} (${row.id})`);
  }
  console.log(`Done — ${companiesSeed.length} Company rows seeded.\n`);
}

async function seedProjects() {
  console.log('Seeding Projects...');
  for (const project of projectsSeed) {
    const row = await prisma.project.upsert({
      where: { code: project.code },
      update: {
        name: project.name,
        companyId: project.companyId,
        status: project.status,
        dueDate: project.dueDate,
        readyForExecution: project.readyForExecution,
        color: project.color,
      },
      create: { ...project },
    });
    console.log(`  ✓ ${row.code} — ${row.name} (${row.id})`);
  }
  console.log(`Done — ${projectsSeed.length} Project rows seeded.\n`);
}

async function seedTestEmployeePairs() {
  const testPassword = process.env.TEST_USERS_SEED_PASSWORD;
  if (!testPassword) {
    console.log('TEST_USERS_SEED_PASSWORD not set — skipping test employee pairs seed.');
    return;
  }

  // Internal test/dummy accounts only — not for production use.
  const passwordHash = await bcrypt.hash(testPassword, 12);

  console.log('Seeding Person + User (EMPLOYEE) pairs...');
  for (const pair of employeePairsSeed) {
    const employeeRoleId = await requireEmployeeRoleId(pair.employeeRoleName);

    const person = await prisma.person.upsert({
      where: { id: pair.personId },
      update: {
        firstName: pair.firstName,
        lastName: pair.lastName,
        employeeRoleId,
      },
      create: {
        id: pair.personId,
        firstName: pair.firstName,
        lastName: pair.lastName,
        employeeRoleId,
      },
    });

    const user = await prisma.user.upsert({
      where: { email: pair.email },
      update: {
        passwordHash,
        role: 'EMPLOYEE',
        isActive: pair.isActive,
        personId: person.id,
      },
      create: {
        email: pair.email,
        passwordHash,
        role: 'EMPLOYEE',
        isActive: pair.isActive,
        personId: person.id,
      },
    });

    console.log(
      `  ✓ ${person.firstName} ${person.lastName} → ${user.email} (isActive: ${user.isActive})`,
    );
  }
  console.log(`Done — ${employeePairsSeed.length} Person+User pairs seeded.\n`);
}

async function main() {
  console.log('Seeding EmployeeRole rows...');
  for (const name of employeeRoles) {
    const role = await prisma.employeeRole.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${role.name} (${role.id})`);
  }
  console.log(`Done — ${employeeRoles.length} EmployeeRole rows seeded.\n`);

  console.log('Seeding Activity rows...');
  for (const { name, color } of activities) {
    const activity = await prisma.activity.upsert({
      where: { name },
      update: { color },
      create: { name, color },
    });
    console.log(`  ✓ ${activity.name} (${activity.id})`);
  }
  console.log(`Done — ${activities.length} Activity rows seeded.\n`);

  await seedAdminUser();
  console.log('');
  await seedEmployeeUser();
  console.log('');
  await seedCompanies();
  await seedProjects();
  await seedTestEmployeePairs();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
