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
  'Debitare (inclusiv CNC intern)',
  'Asamblare',
  'Sudare',
  'Vopsire',
  'Rectificare',
  'Premontaj/Montaj',
  'Administrativ',
  'CNC extern',
];

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
  for (const name of activities) {
    const activity = await prisma.activity.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ ${activity.name} (${activity.id})`);
  }
  console.log(`Done — ${activities.length} Activity rows seeded.\n`);

  await seedAdminUser();
  console.log('');
  await seedEmployeeUser();
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
