/**
 * Shared helpers for perf load-test seeding (dev only).
 * All generated rows are tagged so they can be wiped without touching normal dev seed data.
 */
import type { LeaveStatus, LeaveType, PrismaClient, ProjectStatus, Role } from '@prisma/client';

// ---------------------------------------------------------------------------
// Marker — used to identify and delete ONLY perf-generated rows
// ---------------------------------------------------------------------------

export const PERF_COMPANY_NAME_PREFIX = '[PERF] ';
export const PERF_PROJECT_CODE_PREFIX = 'PERF-PRJ-';
export const PERF_EMAIL_DOMAIN = '@perf.fabxpert.test';

/** Known production Supabase project refs / host patterns — never seed these. */
const BLOCKED_DATABASE_URL_PATTERNS = [
  'icniqqtjchvfcixqkgku', // fabxpert-prod (see apps/api/DEPLOY.md)
  'fabxpert-prod',
  'fabxpert_prod',
  '/prod.',
  'schema=fabxpert_prod',
] as const;

// ---------------------------------------------------------------------------
// Volume targets
// ---------------------------------------------------------------------------

export const PERF_COUNTS = {
  companies: 100,
  persons: 50,
  employeeUsers: 40,
  adminUsers: 3,
  projects: 100,
  timesheets: 300,
  leaveRequests: 40,
  roleRestrictedProjects: 25,
} as const;

// Deterministic UUID namespaces (valid v4-style hex, easy to grep)
export const PERF_ID = {
  company: (n: number) => `a1000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  person: (n: number) => `a2000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  user: (n: number) => `a3000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  project: (n: number) => `a4000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  timesheet: (n: number) => `a5000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
  leaveRequest: (n: number) => `a6000000-0000-0000-0000-${String(n).padStart(12, '0')}`,
} as const;

// ---------------------------------------------------------------------------
// Safety guards
// ---------------------------------------------------------------------------

export function assertPerfSeedAllowed(action: 'seed' | 'clear'): void {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) {
    throw new Error(
      `[perf-${action}] DATABASE_URL is not set. Refusing to run against an unknown database.`,
    );
  }

  if (process.env.ALLOW_PERF_SEED !== 'true') {
    throw new Error(
      `[perf-${action}] Refusing to run: set ALLOW_PERF_SEED=true in the environment.\n` +
        'This is a dev-only load-test tool and must never run in production or CI by accident.',
    );
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(`[perf-${action}] Refusing to run while NODE_ENV=production.`);
  }

  const lowerUrl = databaseUrl.toLowerCase();
  for (const pattern of BLOCKED_DATABASE_URL_PATTERNS) {
    if (lowerUrl.includes(pattern)) {
      throw new Error(
        `[perf-${action}] Refusing to run: DATABASE_URL matches blocked production pattern "${pattern}".`,
      );
    }
  }

  if (lowerUrl.includes('fabxpert_e2e') || lowerUrl.includes('schema=fabxpert_e2e')) {
    throw new Error(
      `[perf-${action}] Refusing to run against the e2e test database (fabxpert_e2e schema).`,
    );
  }

  const testUrl = process.env.TEST_DATABASE_URL?.trim();
  if (testUrl && databaseUrl === testUrl) {
    throw new Error(
      `[perf-${action}] Refusing to run: DATABASE_URL equals TEST_DATABASE_URL (e2e database).`,
    );
  }
}

export async function assertNoExistingPerfData(prisma: PrismaClient): Promise<void> {
  const existing = await prisma.company.count({
    where: { name: { startsWith: PERF_COMPANY_NAME_PREFIX }, deletedAt: null },
  });

  if (existing > 0) {
    throw new Error(
      `Perf seed data already exists (${existing} [PERF] companies found).\n` +
        'Run `pnpm --filter @fabxpert/db db:seed:perf:clear` first, then re-run db:seed:perf.',
    );
  }
}

// ---------------------------------------------------------------------------
// Data pools — plausible Romanian fabrication-industry names
// ---------------------------------------------------------------------------

export const PERF_COLORS = [
  '#3B7EA1',
  '#7A8450',
  '#B5533C',
  '#8E5FA8',
  '#6B6B6B',
  '#C9A227',
  '#8A8A8A',
  '#2F6F4E',
  '#4A6FA5',
  '#9B4F3C',
] as const;

const COMPANY_SUFFIXES = [
  'Metalurgie',
  'Construcții',
  'Industrie',
  'Fabricație',
  'Oțelară',
  'Profile',
  'Structuri',
  'Echipamente',
  'Utilaje',
  'Confecții',
] as const;

const COMPANY_REGIONS = [
  'Transilvania',
  'Muntenia',
  'Oltenia',
  'Moldova',
  'Banat',
  'Crișana',
  'Dobrogea',
  'Ardeal',
  'București',
  'Cluj',
  'Timișoara',
  'Brașov',
  'Iași',
  'Constanța',
  'Ploiești',
] as const;

const FIRST_NAMES = [
  'Ion',
  'Vasile',
  'Gheorghe',
  'Mihai',
  'Andrei',
  'Alexandru',
  'Florin',
  'Cristian',
  'Marian',
  'Adrian',
  'Elena',
  'Maria',
  'Ana',
  'Ioana',
  'Andreea',
  'Carmen',
  'Sorina',
  'Diana',
  'Raluca',
  'Gabriela',
] as const;

const LAST_NAMES = [
  'Popescu',
  'Ionescu',
  'Popa',
  'Radu',
  'Stan',
  'Marin',
  'Dumitru',
  'Stoica',
  'Gheorghe',
  'Munteanu',
  'Dobre',
  'Barbu',
  'Nistor',
  'Florea',
  'Cristea',
  'Moldovan',
  'Tudor',
  'Enache',
  'Diaconu',
  'Vasile',
] as const;

const PROJECT_TYPES = [
  'Structură hală',
  'Grindă macara',
  'Balustradă industrială',
  'Copertină acces',
  'Rampe încărcare',
  'Cadru suport utilaj',
  'Platformă mezanin',
  'Schelă fixă',
  'Container modificat',
  'Panou fațadă',
  'Consolă CNC',
  'Cadru oțel sudat',
  'Gard perimetral',
  'Uși industriale',
  'Trape evacuare',
] as const;

const LEAVE_REASONS = [
  'Concediu de odihnă',
  'Certificat medical',
  'Recuperare post-operator',
  'Eveniment familial',
  'Zile personale',
  'Concediu fără plată — relocare',
  'Control medical periodic',
  null,
] as const;

const PROJECT_STATUSES: ProjectStatus[] = [
  'IN_PRODUCTIE',
  'IN_PROIECTARE',
  'CASTIGAT',
  'PREGATIT_LIVRARE',
  'IN_OFERTARE',
  'SUSPENDAT',
  'CIORNA',
  'LIVRAT',
  'FINALIZAT',
  'ANULAT',
];

const PROJECT_STATUS_WEIGHTS = [20, 15, 12, 10, 8, 5, 8, 7, 10, 5];

const DURATION_MINUTES = [30, 60, 90, 120, 150, 180, 240, 300, 360, 480, 600] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function pick<T>(items: readonly T[], index: number): T {
  return items[index % items.length]!;
}

export function pickWeighted<T>(items: readonly T[], weights: readonly number[], index: number): T {
  const total = weights.reduce((sum, weight) => sum + weight, 0);
  let cursor = index % total;
  for (let i = 0; i < items.length; i++) {
    cursor -= weights[i]!;
    if (cursor < 0) {
      return items[i]!;
    }
  }
  return items[items.length - 1]!;
}

export function perfCompanyName(index: number): string {
  const suffix = pick(COMPANY_SUFFIXES, index);
  const region = pick(COMPANY_REGIONS, index + 3);
  const legalForm = index % 3 === 0 ? 'SA' : 'SRL';
  return `${PERF_COMPANY_NAME_PREFIX}${suffix} ${region} ${legalForm}`;
}

export function perfPersonName(index: number): { firstName: string; lastName: string } {
  return {
    firstName: pick(FIRST_NAMES, index),
    lastName: pick(LAST_NAMES, index + 7),
  };
}

export function perfProjectName(index: number): string {
  return `${pick(PROJECT_TYPES, index)} ${index + 1}`;
}

export function perfProjectCode(index: number): string {
  return `${PERF_PROJECT_CODE_PREFIX}${String(index + 1).padStart(4, '0')}`;
}

export function perfPersonEmail(index: number, role: Role): string {
  const prefix = role === 'ADMIN' ? 'perf.admin' : 'perf.employee';
  return `${prefix}${String(index).padStart(3, '0')}${PERF_EMAIL_DOMAIN}`;
}

export function perfTaxCode(index: number): string {
  return `PERF${String(index + 1).padStart(10, '0')}`;
}

export function dateOnly(year: number, month: number, day: number): Date {
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function daysAgo(days: number, from = new Date()): Date {
  const date = new Date(from);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - days);
  return date;
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

export function resolvePerfPassword(): string {
  const password =
    process.env.PERF_SEED_PASSWORD?.trim() || process.env.TEST_USERS_SEED_PASSWORD?.trim();
  if (!password) {
    throw new Error(
      'Set PERF_SEED_PASSWORD or TEST_USERS_SEED_PASSWORD for perf user accounts.',
    );
  }
  return password;
}

export type LookupData = {
  rolesByName: Map<string, string>;
  roleIds: string[];
  activities: { id: string; name: string }[];
  reviewerUserId: string;
};

export async function loadLookups(prisma: PrismaClient): Promise<LookupData> {
  const [roles, activities, reviewer] = await Promise.all([
    prisma.employeeRole.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.activity.findMany({
      where: { deletedAt: null, isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findFirst({
      where: { role: 'ADMIN', deletedAt: null, isActive: true },
      select: { id: true },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  if (roles.length === 0) {
    throw new Error('No EmployeeRole rows found — run db:seed:dev first (lookup data).');
  }

  if (!roles.some((role) => role.name === 'Operator CNC')) {
    throw new Error('Operator CNC role missing — run db:seed:dev first.');
  }

  if (activities.length === 0) {
    throw new Error('No Activity rows found — run db:seed:dev first.');
  }

  if (!reviewer) {
    throw new Error('No ADMIN user found for leave reviews — run db:seed:dev first.');
  }

  return {
    rolesByName: new Map(roles.map((role) => [role.name, role.id])),
    roleIds: roles.map((role) => role.id),
    activities,
    reviewerUserId: reviewer.id,
  };
}

export function buildProjectStatus(index: number): ProjectStatus {
  return pickWeighted(PROJECT_STATUSES, PROJECT_STATUS_WEIGHTS, index);
}

export function buildLeaveSpec(
  index: number,
  _personIndex: number,
  year: number,
): {
  type: LeaveType;
  status: LeaveStatus;
  startDate: Date;
  endDate: Date;
  reason: string | null;
} {
  const typeCycle: LeaveType[] = ['ODIHNA', 'ODIHNA', 'MEDICAL', 'NEPLATIT'];
  const type = pick(typeCycle, index);

  let status: LeaveStatus;
  if (index % 11 === 0) {
    status = 'RESPINS';
  } else if (index % 4 === 0) {
    status = 'IN_ASTEPTARE';
  } else {
    status = 'APROBAT';
  }

  // Spread across the year; a few entries touch today/yesterday for Panou filters
  let startMonth = (index % 12) + 1;
  let startDay = (index % 20) + 1;
  if (index === 0) {
    startMonth = new Date().getMonth() + 1;
    startDay = new Date().getDate();
  } else if (index === 1) {
    const yesterday = daysAgo(1);
    startMonth = yesterday.getMonth() + 1;
    startDay = yesterday.getDate();
  }

  const durationDays = type === 'MEDICAL' ? 1 + (index % 3) : 2 + (index % 5);
  const startDate = dateOnly(year, startMonth, startDay);
  const endDate = addDays(startDate, durationDays - 1);

  return {
    type,
    status,
    startDate,
    endDate,
    reason: pick(LEAVE_REASONS, index),
  };
}

export function buildTimesheetDuration(index: number): number {
  return pick(DURATION_MINUTES, index);
}

export function formatElapsedMs(startedAt: number): string {
  const seconds = (Date.now() - startedAt) / 1000;
  return seconds < 60 ? `${seconds.toFixed(1)}s` : `${(seconds / 60).toFixed(1)}m`;
}
