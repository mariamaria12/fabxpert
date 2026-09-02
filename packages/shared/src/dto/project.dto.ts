import { z } from 'zod';

export const PROJECT_STATUS_VALUES = [
  'CIORNA',
  'IN_OFERTARE',
  'CASTIGAT',
  'IN_PROIECTARE',
  'IN_PRODUCTIE',
  'PREGATIT_LIVRARE',
  'LIVRAT',
  'FINALIZAT',
  'SUSPENDAT',
  'ANULAT',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUS_VALUES)[number];

export type ProjectStatusGroup = 'in_progress' | 'completed';

export const PROJECT_LIST_SORT_BY_VALUES = [
  /** Default list order: IN_PRODUCTIE first, FINALIZAT last, each by start date. */
  'statusPriority',
  'name',
  'denumireLucrare',
  'finisaj',
  'weight',
  'estimatedHours',
  'code',
  'company',
  'startDate',
  'dueDate',
] as const;

export type ProjectListSortBy = (typeof PROJECT_LIST_SORT_BY_VALUES)[number];

export const SORT_ORDER_VALUES = ['asc', 'desc'] as const;

export type SortOrder = (typeof SORT_ORDER_VALUES)[number];

const projectStatusSchema = z.enum(PROJECT_STATUS_VALUES);

const companyIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const roleIdSchema = z
  .string()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-Fa-f]{6}$/, 'Color must be a hex value in the form #RRGGBB');

const visibleForRoleIdsSchema = z.array(roleIdSchema);

/** Free text; empty is stored as null so "not filled in" stays a single state. */
const denumireLucrareSchema = z
  .union([z.string().trim(), z.null()])
  .transform((value) => (value ? value : null));

/** Free text; empty is stored as null so "no notes" stays a single state. */
const notesSchema = z
  .union([z.string().trim(), z.null()])
  .transform((value) => (value ? value : null));

const finisajSchema = z
  .union([z.string().trim().max(100, 'Finisaj must be at most 100 characters'), z.null()])
  .transform((value) => (value ? value : null));

/** Weight in kilograms; empty is stored as null so "not filled in" stays a single state. */
const weightSchema = z.union([
  z
    .number()
    .finite('Weight must be a number')
    .nonnegative('Weight cannot be negative')
    .max(1_000_000, 'Weight must be at most 1000000 kg'),
  z.null(),
]);

/** Estimated work hours; empty is stored as null so "not filled in" stays a single state. */
const estimatedHoursSchema = z.union([
  z
    .number()
    .finite('Estimated hours must be a number')
    .nonnegative('Estimated hours cannot be negative')
    .max(1_000_000, 'Estimated hours must be at most 1000000'),
  z.null(),
]);

export const createProjectSchema = z.object({
  name: z.string().trim().min(1, 'Name is required'),
  denumireLucrare: denumireLucrareSchema.optional(),
  finisaj: finisajSchema.optional(),
  weight: weightSchema.optional(),
  estimatedHours: estimatedHoursSchema.optional(),
  notes: notesSchema.optional(),
  code: z.string().trim().min(1, 'Code is required'),
  companyId: companyIdSchema,
  status: projectStatusSchema.optional(),
  startDate: z.coerce.date().optional(),
  dueDate: z.coerce.date().optional(),
  readyForExecution: z.boolean().optional(),
  isPinned: z.boolean().optional(),
  color: hexColorSchema.optional(),
  /** Omitted or [] = visible to all employees. */
  visibleForRoleIds: visibleForRoleIdsSchema.optional(),
});

export const updateProjectSchema = createProjectSchema
  .extend({
    color: z.union([hexColorSchema, z.null()]).optional(),
  })
  .partial()
  .refine(
  (data) => data.name === undefined || data.name.trim().length > 0,
  { message: 'Name cannot be empty', path: ['name'] },
).refine(
  (data) => data.code === undefined || data.code.trim().length > 0,
  { message: 'Code cannot be empty', path: ['code'] },
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;

export type ProjectCompanyDto = {
  id: string;
  name: string;
};

export type ProjectVisibleRoleDto = {
  id: string;
  name: string;
};

/** API-facing Project shape — deletedAt is an internal implementation detail. */
export type ProjectDto = {
  id: string;
  name: string;
  /** Work description parsed out of the project name; null until filled in. */
  denumireLucrare: string | null;
  /** Finish (e.g. ZINCARE, RAL9002); null until filled in. */
  finisaj: string | null;
  /** Weight in kilograms; null until filled in. */
  weight: number | null;
  /** Estimated work hours; null until filled in. */
  estimatedHours: number | null;
  /** Free-text admin notes; null when empty. */
  notes: string | null;
  code: string;
  status: ProjectStatus;
  startDate: string | null;
  dueDate: string | null;
  readyForExecution: boolean;
  isPinned: boolean;
  indexPanou: number | null;
  panouColumn: number | null;
  color: string | null;
  companyId: string;
  company: ProjectCompanyDto;
  /** Empty = visible to all employees with readyForExecution. */
  visibleForRoles: ProjectVisibleRoleDto[];
  /** Lines on the project's assembly list; 0 when no list was imported yet. */
  assemblyCount: number;
  createdAt: string;
  updatedAt: string;
};

/** Reduced shape for employee project selection (mobile dropdown). */
export type ProjectOptionDto = {
  id: string;
  name: string;
  denumireLucrare: string | null;
  finisaj: string | null;
  /** Free-text admin notes; shown behind the info icon on the project card. */
  notes: string | null;
  code: string;
  color: string | null;
  company: {
    name: string;
  };
};
