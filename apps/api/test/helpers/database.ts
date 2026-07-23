import { execSync } from 'child_process';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { E2E_PASSWORD, FIXTURES } from './fixtures';

let prisma: PrismaClient | null = null;

function getTestDatabaseUrl(): string | undefined {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return undefined;
  }

  try {
    const url = new URL(raw);
    if (!url.searchParams.has('connection_limit')) {
      // Nest also opens a capped client during e2e — keep the helper small.
      url.searchParams.set('connection_limit', '1');
    }
    return url.toString();
  } catch {
    return raw;
  }
}

export function getTestPrisma(): PrismaClient {
  if (!prisma) {
    const url = getTestDatabaseUrl();
    prisma = url
      ? new PrismaClient({ datasources: { db: { url } } })
      : new PrismaClient();
  }
  return prisma;
}

export async function disconnectTestPrisma(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
    prisma = null;
  }
}

export function runMigrations(): void {
  const dbRoot = resolve(__dirname, '../../../../packages/db');
  execSync('npx prisma migrate deploy', {
    cwd: dbRoot,
    stdio: 'inherit',
    env: process.env,
  });
}

export async function truncateAllTables(): Promise<void> {
  const client = getTestPrisma();
  await client.$executeRawUnsafe(`
    TRUNCATE TABLE
      leave_requests,
      timesheets,
      users,
      projects,
      persons,
      companies,
      activities,
      employee_roles
    RESTART IDENTITY CASCADE
  `);
}

export async function seedFixtures(): Promise<void> {
  const client = getTestPrisma();
  const passwordHash = await bcrypt.hash(E2E_PASSWORD, 12);

  await client.employeeRole.createMany({
    data: [
      {
        id: FIXTURES.employeeRole.id,
        name: FIXTURES.employeeRole.name,
        isActive: true,
      },
      {
        id: FIXTURES.employeeRole2.id,
        name: FIXTURES.employeeRole2.name,
        isActive: true,
      },
    ],
  });

  await client.activity.createMany({
    data: [
      {
        id: FIXTURES.activities.active.id,
        name: FIXTURES.activities.active.name,
        isActive: true,
      },
      {
        id: FIXTURES.activities.inactive.id,
        name: FIXTURES.activities.inactive.name,
        isActive: false,
      },
      {
        id: FIXTURES.activities.second.id,
        name: FIXTURES.activities.second.name,
        isActive: true,
        color: '#AABBCC',
      },
    ],
  });

  await client.company.createMany({
    data: [
      { id: FIXTURES.companies.c1.id, name: FIXTURES.companies.c1.name },
      { id: FIXTURES.companies.c2.id, name: FIXTURES.companies.c2.name },
    ],
  });

  await client.project.createMany({
    data: [
      {
        id: FIXTURES.projects.ready.id,
        name: 'E2E Ready Project',
        code: FIXTURES.projects.ready.code,
        companyId: FIXTURES.companies.c1.id,
        readyForExecution: true,
        color: '#112233',
      },
      {
        id: FIXTURES.projects.notReady.id,
        name: 'E2E Not Ready Project',
        code: FIXTURES.projects.notReady.code,
        companyId: FIXTURES.companies.c1.id,
        readyForExecution: false,
        color: '#445566',
      },
      {
        id: FIXTURES.projects.deleted.id,
        name: 'E2E Deleted Project',
        code: FIXTURES.projects.deleted.code,
        companyId: FIXTURES.companies.c2.id,
        readyForExecution: true,
        deletedAt: new Date('2020-01-01T00:00:00.000Z'),
      },
      {
        id: FIXTURES.projects.roleRestricted.id,
        name: 'E2E Role Restricted Project',
        code: FIXTURES.projects.roleRestricted.code,
        companyId: FIXTURES.companies.c1.id,
        readyForExecution: true,
        color: '#778899',
      },
      {
        id: FIXTURES.projects.roleRestrictedOther.id,
        name: 'E2E Role2 Restricted Project',
        code: FIXTURES.projects.roleRestrictedOther.code,
        companyId: FIXTURES.companies.c1.id,
        readyForExecution: true,
        color: '#99aabb',
      },
    ],
  });

  await client.project.update({
    where: { id: FIXTURES.projects.roleRestricted.id },
    data: {
      visibleForRoles: {
        connect: [{ id: FIXTURES.employeeRole.id }],
      },
    },
  });

  await client.project.update({
    where: { id: FIXTURES.projects.roleRestrictedOther.id },
    data: {
      visibleForRoles: {
        connect: [{ id: FIXTURES.employeeRole2.id }],
      },
    },
  });

  await client.person.createMany({
    data: [
      {
        id: FIXTURES.persons.admin.id,
        firstName: 'E2E',
        lastName: 'Admin',
      },
      {
        id: FIXTURES.persons.employee1.id,
        firstName: 'E2E',
        lastName: 'EmployeeOne',
        employeeRoleId: FIXTURES.employeeRole.id,
      },
      {
        id: FIXTURES.persons.employee2.id,
        firstName: 'E2E',
        lastName: 'EmployeeTwo',
      },
      {
        id: FIXTURES.persons.inactive.id,
        firstName: 'E2E',
        lastName: 'Inactive',
      },
      {
        id: FIXTURES.persons.unassigned.id,
        firstName: 'E2E',
        lastName: 'Unassigned',
      },
    ],
  });

  await client.user.createMany({
    data: [
      {
        id: FIXTURES.users.admin.id,
        email: FIXTURES.users.admin.email,
        passwordHash,
        role: 'ADMIN',
        personId: FIXTURES.persons.admin.id,
      },
      {
        id: FIXTURES.users.employee1.id,
        email: FIXTURES.users.employee1.email,
        passwordHash,
        role: 'EMPLOYEE',
        personId: FIXTURES.persons.employee1.id,
      },
      {
        id: FIXTURES.users.employee2.id,
        email: FIXTURES.users.employee2.email,
        passwordHash,
        role: 'EMPLOYEE',
        personId: FIXTURES.persons.employee2.id,
      },
      {
        id: FIXTURES.users.inactive.id,
        email: FIXTURES.users.inactive.email,
        passwordHash,
        role: 'EMPLOYEE',
        isActive: false,
        personId: FIXTURES.persons.inactive.id,
      },
    ],
  });
}

export async function resetAndSeedDatabase(): Promise<void> {
  await truncateAllTables();
  await seedFixtures();
}
