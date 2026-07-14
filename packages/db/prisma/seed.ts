import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import {
  seedActivities,
  seedAdminUser,
  seedEmployeeRoles,
} from './seed.shared';

const prisma = new PrismaClient();

const EMPLOYEE_PERSON_ID = '00000000-0000-0000-0000-000000000002';

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
// Demo / test data — Companies, Projects, Person+User pairs (dev only)
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
    startDate: new Date('2026-05-01'),
    dueDate: new Date('2026-07-15'),
    readyForExecution: true,
    color: '#C9A227',
  },
  {
    code: 'PRJ-0003',
    name: 'Structură hală',
    companyId: COMPANY_IDS.metalexport,
    status: 'CASTIGAT' as const,
    startDate: new Date('2026-06-01'),
    dueDate: new Date('2026-08-20'),
    readyForExecution: false,
    color: '#7A8450',
  },
  {
    code: 'PRJ-0004',
    name: 'Copertină acces',
    companyId: COMPANY_IDS.lidl,
    status: 'PREGATIT_LIVRARE' as const,
    startDate: new Date('2026-05-15'),
    dueDate: new Date('2026-07-10'),
    readyForExecution: true,
    color: '#B5533C',
  },
  {
    code: 'PRJ-0005',
    name: 'Balustrade industriale',
    companyId: COMPANY_IDS.steelcor,
    status: 'LIVRAT' as const,
    startDate: new Date('2026-05-01'),
    dueDate: new Date('2026-07-01'),
    readyForExecution: true,
    color: '#6B6B6B',
  },
  {
    code: 'PRJ-0008',
    name: 'Grindă macara uzină',
    companyId: COMPANY_IDS.dacia,
    status: 'FINALIZAT' as const,
    startDate: new Date('2026-04-01'),
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
        startDate: project.startDate,
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

/** One role-restricted ready project for manual testing; most projects stay visible to all. */
async function seedProjectRoleVisibility() {
  const cncRole = await prisma.employeeRole.findUnique({
    where: { name: 'Operator CNC' },
  });
  if (!cncRole) {
    return;
  }

  const project = await prisma.project.findUnique({ where: { code: 'PRJ-0005' } });
  if (!project) {
    return;
  }

  await prisma.project.update({
    where: { id: project.id },
    data: {
      visibleForRoles: { set: [{ id: cncRole.id }] },
    },
  });

  console.log(`  ✓ ${project.code} visible only for "${cncRole.name}"\n`);
}

async function seedTestEmployeePairs() {
  const testPassword = process.env.TEST_USERS_SEED_PASSWORD;
  if (!testPassword) {
    console.log('TEST_USERS_SEED_PASSWORD not set — skipping test employee pairs seed.');
    return;
  }

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
  await seedEmployeeRoles(prisma);
  await seedActivities(prisma);
  await seedAdminUser(prisma);
  console.log('');
  await seedEmployeeUser();
  console.log('');
  await seedCompanies();
  await seedProjects();
  await seedProjectRoleVisibility();
  await seedTestEmployeePairs();
  await seedLeaveRequests();
}

const LEAVE_REQUEST_IDS = {
  pendingOdihna: 'l0000000-0000-0000-0000-000000000001',
  approvedMedical: 'l0000000-0000-0000-0000-000000000002',
} as const;

async function seedLeaveRequests() {
  const ionPersonId = 'p0000000-0000-0000-0000-000000000001';
  const adminUser = await prisma.user.findFirst({
    where: { role: 'ADMIN', deletedAt: null },
    select: { id: true },
  });

  const pendingStart = new Date(new Date().getFullYear(), 5, 10, 0, 0, 0, 0);
  const pendingEnd = new Date(new Date().getFullYear(), 5, 12, 0, 0, 0, 0);
  const medicalStart = new Date(new Date().getFullYear(), 2, 3, 0, 0, 0, 0);
  const medicalEnd = new Date(new Date().getFullYear(), 2, 4, 0, 0, 0, 0);

  await prisma.leaveRequest.upsert({
    where: { id: LEAVE_REQUEST_IDS.pendingOdihna },
    update: {
      personId: ionPersonId,
      type: 'ODIHNA',
      startDate: pendingStart,
      endDate: pendingEnd,
      status: 'IN_ASTEPTARE',
      reason: 'Concediu de vară',
      reviewedByUserId: null,
      reviewedAt: null,
      deletedAt: null,
    },
    create: {
      id: LEAVE_REQUEST_IDS.pendingOdihna,
      personId: ionPersonId,
      type: 'ODIHNA',
      startDate: pendingStart,
      endDate: pendingEnd,
      status: 'IN_ASTEPTARE',
      reason: 'Concediu de vară',
    },
  });

  if (!adminUser) {
    return;
  }

  await prisma.leaveRequest.upsert({
    where: { id: LEAVE_REQUEST_IDS.approvedMedical },
    update: {
      personId: ionPersonId,
      type: 'MEDICAL',
      startDate: medicalStart,
      endDate: medicalEnd,
      status: 'APROBAT',
      reason: 'Certificat medical',
      reviewedByUserId: adminUser.id,
      reviewedAt: new Date(),
      deletedAt: null,
    },
    create: {
      id: LEAVE_REQUEST_IDS.approvedMedical,
      personId: ionPersonId,
      type: 'MEDICAL',
      startDate: medicalStart,
      endDate: medicalEnd,
      status: 'APROBAT',
      reason: 'Certificat medical',
      reviewedByUserId: adminUser.id,
      reviewedAt: new Date(),
    },
  });

  console.log('  ✓ Sample leave requests seeded.\n');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
