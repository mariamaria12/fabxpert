/**
 * Performance / load-test seed — dev only.
 *
 * Populates high-volume realistic data tagged with [PERF] markers.
 * Does NOT modify seed.ts / seed:dev / seed:prod.
 *
 * Prerequisites: normal dev seed (lookups + admin) already applied.
 *
 *   ALLOW_PERF_SEED=true PERF_SEED_PASSWORD='...' pnpm --filter @fabxpert/db db:seed:perf
 */
import * as bcrypt from 'bcryptjs';
import { createSeedPrismaClient } from './create-seed-prisma';
import {
  PERF_COUNTS,
  PERF_COLORS,
  PERF_ID,
  addDays,
  assertNoExistingPerfData,
  assertPerfSeedAllowed,
  buildLeaveSpec,
  buildProjectStatus,
  buildTimesheetDuration,
  dateOnly,
  daysAgo,
  formatElapsedMs,
  loadLookups,
  perfCompanyName,
  perfPersonEmail,
  perfPersonName,
  perfProjectCode,
  perfProjectName,
  perfTaxCode,
  pick,
  resolvePerfPassword,
} from './seed-perf.shared';

const prisma = createSeedPrismaClient();

async function seedCompanies() {
  const rows = Array.from({ length: PERF_COUNTS.companies }, (_, index) => ({
    id: PERF_ID.company(index + 1),
    name: perfCompanyName(index),
    taxCode: perfTaxCode(index),
    tradeRegistryNumber: `J${String((index % 40) + 1).padStart(2, '0')}/${1000 + index}/${2010 + (index % 14)}`,
    registeredAddress: `Str. Industriilor nr. ${index + 1}, România`,
    phone: `07${String(20000000 + index).slice(0, 8)}`,
    email: `contact${index + 1}@perf-client.test`,
    legalRepresentative: `${pick(['Ion', 'Vasile', 'Elena', 'Mihai'], index)} Reprezentant`,
    contactPerson: `Contact ${index + 1}`,
    contactPersonPhone: `07${String(30000000 + index).slice(0, 8)}`,
    color: pick(PERF_COLORS, index),
  }));

  const result = await prisma.company.createMany({ data: rows });
  return result.count;
}

async function seedPersons(lookups: Awaited<ReturnType<typeof loadLookups>>) {
  const roleNames = [...lookups.rolesByName.keys()];
  const rows = Array.from({ length: PERF_COUNTS.persons }, (_, index) => {
    const personIndex = index + 1;
    const { firstName, lastName } = perfPersonName(index);
    const roleName = pick(roleNames, index);
    const employeeRoleId = lookups.rolesByName.get(roleName)!;

    let annualLeaveDays = 21;
    if (personIndex % 9 === 0) {
      annualLeaveDays = 25;
    } else if (personIndex % 11 === 0) {
      annualLeaveDays = 18;
    } else if (personIndex === 10) {
      annualLeaveDays = 21; // heavy ODIHNA in leave seed triggers over-balance
    } else if (personIndex % 13 === 0) {
      annualLeaveDays = 30;
    }

    const hasUser = personIndex <= PERF_COUNTS.adminUsers + PERF_COUNTS.employeeUsers;
    const role =
      personIndex <= PERF_COUNTS.adminUsers
        ? ('ADMIN' as const)
        : hasUser
          ? ('EMPLOYEE' as const)
          : null;

    return {
      id: PERF_ID.person(personIndex),
      firstName,
      lastName,
      email: hasUser
        ? perfPersonEmail(personIndex, role === 'ADMIN' ? 'ADMIN' : 'EMPLOYEE')
        : `perf.person${String(personIndex).padStart(3, '0')}@no-login.test`,
      phone: `07${String(40000000 + index).slice(0, 8)}`,
      annualLeaveDays,
      employeeRoleId,
    };
  });

  const result = await prisma.person.createMany({ data: rows });
  return result.count;
}

async function seedUsers(passwordHash: string) {
  const rows = Array.from(
    { length: PERF_COUNTS.adminUsers + PERF_COUNTS.employeeUsers },
    (_, index) => {
      const userIndex = index + 1;
      const personIndex = userIndex;
      const role = userIndex <= PERF_COUNTS.adminUsers ? 'ADMIN' : 'EMPLOYEE';

      return {
        id: PERF_ID.user(userIndex),
        email: perfPersonEmail(personIndex, role),
        passwordHash,
        role,
        isActive: userIndex % 17 !== 0,
        personId: PERF_ID.person(personIndex),
      };
    },
  );

  const result = await prisma.user.createMany({ data: rows });
  return result.count;
}

async function seedProjects() {
  const rows = Array.from({ length: PERF_COUNTS.projects }, (_, index) => {
    const projectIndex = index + 1;
    const companyIndex = (index % PERF_COUNTS.companies) + 1;
    const status = buildProjectStatus(index);
    const readyForExecution = index % 3 !== 0;

    const monthsAgo = index % 4;
    const startDate = daysAgo(30 + monthsAgo * 20 + (index % 15));
    let dueDate = addDays(startDate, 20 + (index % 60));

    // ~15 overdue in-progress projects
    if (index % 7 === 0 && !['FINALIZAT', 'ANULAT', 'LIVRAT'].includes(status)) {
      dueDate = daysAgo(3 + (index % 20));
    }

    return {
      id: PERF_ID.project(projectIndex),
      name: perfProjectName(index),
      code: perfProjectCode(index),
      companyId: PERF_ID.company(companyIndex),
      status,
      startDate,
      dueDate,
      readyForExecution,
      color: pick(PERF_COLORS, index + 2),
    };
  });

  const result = await prisma.project.createMany({ data: rows });
  return result.count;
}

async function seedProjectVisibility(lookups: Awaited<ReturnType<typeof loadLookups>>) {
  const cncRoleId = lookups.rolesByName.get('Operator CNC');
  if (!cncRoleId) {
    throw new Error('Operator CNC role not found');
  }

  let updated = 0;
  for (let index = 0; index < PERF_COUNTS.roleRestrictedProjects; index++) {
    const projectId = PERF_ID.project(index + 1);
    const roleIds =
      index % 4 === 0
        ? [cncRoleId]
        : [pick(lookups.roleIds, index), pick(lookups.roleIds, index + 2)];

    await prisma.project.update({
      where: { id: projectId },
      data: {
        visibleForRoles: {
          set: roleIds.map((id) => ({ id })),
        },
      },
    });
    updated += 1;
  }

  return updated;
}

async function seedTimesheets(lookups: Awaited<ReturnType<typeof loadLookups>>) {
  const fallbackUserId = PERF_ID.user(1);
  const rows = Array.from({ length: PERF_COUNTS.timesheets }, (_, index) => {
    const personIndex = (index % PERF_COUNTS.persons) + 1;
    const projectIndex = (index % PERF_COUNTS.projects) + 1;
    const daysBack = index % 90;
    const workDate = daysAgo(daysBack);

    const hasOwnUser = personIndex <= PERF_COUNTS.adminUsers + PERF_COUNTS.employeeUsers;
    const userId = hasOwnUser ? PERF_ID.user(personIndex) : fallbackUserId;

    const useActivity = index % 10 !== 0;
    const activity = pick(lookups.activities, index);

    return {
      id: PERF_ID.timesheet(index + 1),
      personId: PERF_ID.person(personIndex),
      userId,
      projectId: PERF_ID.project(projectIndex),
      activityId: useActivity ? activity.id : null,
      workDate,
      durationMinutes: buildTimesheetDuration(index),
      notes: index % 6 === 0 ? `Notă pontaj perf #${index + 1}` : null,
    };
  });

  const created = await prisma.timesheet.createMany({ data: rows });
  return created.count;
}

async function seedLeaveRequests(lookups: Awaited<ReturnType<typeof loadLookups>>) {
  const year = new Date().getFullYear();
  const rows = Array.from({ length: PERF_COUNTS.leaveRequests }, (_, index) => {
    let personIndex = (index % PERF_COUNTS.persons) + 1;

    // Person 10: five approved ODIHNA blocks (5×5 days) to exercise over-balance warning
    if (index >= 35 && index <= 39) {
      personIndex = 10;
      const startDate = dateOnly(year, 2, 3 + (index - 35) * 7);
      return {
        id: PERF_ID.leaveRequest(index + 1),
        personId: PERF_ID.person(personIndex),
        type: 'ODIHNA' as const,
        startDate,
        endDate: addDays(startDate, 4),
        status: 'APROBAT' as const,
        reason: 'Bloc concediu odihnă (test over-balance)',
        reviewedByUserId: lookups.reviewerUserId,
        reviewedAt: addDays(startDate, 5),
      };
    }

    const spec = buildLeaveSpec(index, personIndex, year);
    const reviewed =
      spec.status === 'APROBAT' || spec.status === 'RESPINS'
        ? {
            reviewedByUserId: lookups.reviewerUserId,
            reviewedAt: addDays(spec.endDate, 1),
          }
        : {
            reviewedByUserId: null,
            reviewedAt: null,
          };

    return {
      id: PERF_ID.leaveRequest(index + 1),
      personId: PERF_ID.person(personIndex),
      type: spec.type,
      startDate: spec.startDate,
      endDate: spec.endDate,
      status: spec.status,
      reason: spec.reason,
      ...reviewed,
    };
  });

  const result = await prisma.leaveRequest.createMany({ data: rows });
  return result.count;
}

async function main() {
  const startedAt = Date.now();
  assertPerfSeedAllowed('seed');
  await assertNoExistingPerfData(prisma);

  console.log('FabXpert perf seed — load-test data (dev only)\n');
  console.log(`Marker: company names "${perfCompanyName(0).slice(0, 7)}...", project codes "PERF-PRJ-####", emails "*@perf.fabxpert.test"\n`);

  const lookups = await loadLookups(prisma);
  const passwordHash = await bcrypt.hash(resolvePerfPassword(), 12);

  const companies = await seedCompanies();
  console.log(`  ✓ Companies: ${companies}`);

  const persons = await seedPersons(lookups);
  console.log(`  ✓ Persons: ${persons}`);

  const users = await seedUsers(passwordHash);
  console.log(`  ✓ Users: ${users} (${PERF_COUNTS.adminUsers} ADMIN, ${PERF_COUNTS.employeeUsers} EMPLOYEE)`);

  const projects = await seedProjects();
  console.log(`  ✓ Projects: ${projects}`);

  const visibility = await seedProjectVisibility(lookups);
  console.log(`  ✓ Projects with role visibility: ${visibility}`);

  const timesheets = await seedTimesheets(lookups);
  console.log(`  ✓ Timesheets: ${timesheets}`);

  const leaveRequests = await seedLeaveRequests(lookups);
  console.log(`  ✓ Leave requests: ${leaveRequests}`);

  console.log(`\nDone in ${formatElapsedMs(startedAt)}.`);
  console.log('Wipe perf data only: pnpm --filter @fabxpert/db db:seed:perf:clear');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
