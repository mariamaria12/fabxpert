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

  console.log(`\nDone — ${employeeRoles.length} EmployeeRole rows seeded.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
