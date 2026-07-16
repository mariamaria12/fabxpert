/**
 * Wipes ONLY perf load-test data (tagged rows), leaving normal dev seed intact.
 *
 *   ALLOW_PERF_SEED=true pnpm --filter @fabxpert/db db:seed:perf:clear
 */
import { createSeedPrismaClient } from './create-seed-prisma';
import {
  PERF_COMPANY_NAME_PREFIX,
  PERF_EMAIL_DOMAIN,
  PERF_PROJECT_CODE_PREFIX,
  assertPerfSeedAllowed,
  formatElapsedMs,
} from './seed-perf.shared';

const prisma = createSeedPrismaClient();

async function main() {
  const startedAt = Date.now();
  assertPerfSeedAllowed('clear');

  console.log('FabXpert perf seed clear — removing tagged load-test data only\n');

  const perfCompanies = await prisma.company.findMany({
    where: { name: { startsWith: PERF_COMPANY_NAME_PREFIX } },
    select: { id: true },
  });
  const perfCompanyIds = perfCompanies.map((row) => row.id);

  const perfProjects = await prisma.project.findMany({
    where: { code: { startsWith: PERF_PROJECT_CODE_PREFIX } },
    select: { id: true },
  });
  const perfProjectIds = perfProjects.map((row) => row.id);

  const perfPersons = await prisma.person.findMany({
    where: {
      OR: [
        { email: { endsWith: PERF_EMAIL_DOMAIN } },
        { email: { endsWith: '@no-login.test' } },
        { id: { startsWith: 'a2000000-' } },
      ],
    },
    select: { id: true },
  });
  const perfPersonIds = perfPersons.map((row) => row.id);

  const perfUsers = await prisma.user.findMany({
    where: {
      OR: [
        { email: { endsWith: PERF_EMAIL_DOMAIN } },
        { id: { startsWith: 'a3000000-' } },
      ],
    },
    select: { id: true },
  });
  const perfUserIds = perfUsers.map((row) => row.id);

  if (
    perfCompanyIds.length === 0 &&
    perfProjectIds.length === 0 &&
    perfPersonIds.length === 0
  ) {
    console.log('No perf-tagged data found — nothing to delete.');
    return;
  }

  const deletedLeave = await prisma.leaveRequest.deleteMany({
    where: {
      OR: [
        { personId: { in: perfPersonIds } },
        { id: { startsWith: 'a6000000-' } },
      ],
    },
  });

  const deletedTimesheets = await prisma.timesheet.deleteMany({
    where: {
      OR: [
        { personId: { in: perfPersonIds } },
        { projectId: { in: perfProjectIds } },
        { id: { startsWith: 'a5000000-' } },
      ],
    },
  });

  const deletedUsers = await prisma.user.deleteMany({
    where: { id: { in: perfUserIds } },
  });

  const deletedProjects = await prisma.project.deleteMany({
    where: { id: { in: perfProjectIds } },
  });

  const deletedPersons = await prisma.person.deleteMany({
    where: { id: { in: perfPersonIds } },
  });

  const deletedCompanies = await prisma.company.deleteMany({
    where: { id: { in: perfCompanyIds } },
  });

  console.log(`  ✓ Leave requests deleted: ${deletedLeave.count}`);
  console.log(`  ✓ Timesheets deleted: ${deletedTimesheets.count}`);
  console.log(`  ✓ Users deleted: ${deletedUsers.count}`);
  console.log(`  ✓ Projects deleted: ${deletedProjects.count}`);
  console.log(`  ✓ Persons deleted: ${deletedPersons.count}`);
  console.log(`  ✓ Companies deleted: ${deletedCompanies.count}`);
  console.log(`\nDone in ${formatElapsedMs(startedAt)}. Normal dev seed data was not touched.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
