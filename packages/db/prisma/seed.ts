import { PrismaClient } from '@prisma/client';

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
  console.log(`Done — ${activities.length} Activity rows seeded.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
