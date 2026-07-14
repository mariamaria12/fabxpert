import type { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

export const employeeRoles = [
  'Sudor',
  'Vopsitor',
  'Șofer',
  'Lăcătuș mecanic',
  'Muncitor necalificat',
  'Administrativ',
  'Operator CNC',
] as const;

export const activities = [
  { name: 'Debitare (inclusiv CNC intern)', color: '#3B7EA1' },
  { name: 'Asamblare', color: '#7A8450' },
  { name: 'Sudare', color: '#B5533C' },
  { name: 'Vopsire', color: '#8E5FA8' },
  { name: 'Rectificare', color: '#6B6B6B' },
  { name: 'Premontaj/Montaj', color: '#C9A227' },
  { name: 'Administrativ', color: '#8A8A8A' },
  { name: 'CNC extern', color: '#2F6F4E' },
] as const;

const ADMIN_PERSON_ID = '00000000-0000-0000-0000-000000000001';

export async function seedEmployeeRoles(prisma: PrismaClient): Promise<void> {
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
}

export async function seedActivities(prisma: PrismaClient): Promise<void> {
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
}

export async function seedAdminUser(prisma: PrismaClient): Promise<void> {
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
