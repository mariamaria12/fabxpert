import { z } from 'zod';

export const USER_ROLE_VALUES = ['ADMIN', 'EMPLOYEE'] as const;

export type UserRole = (typeof USER_ROLE_VALUES)[number];

const userRoleSchema = z.enum(USER_ROLE_VALUES);

/** Accepts seed person ids with `p` prefix (same as timesheet personId). */
const personIdSchema = z
  .string()
  .regex(
    /^([0-9a-f]{8}|p[0-9a-f]{7})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    'Invalid UUID format',
  );

const passwordSchema = z.string().min(8, 'Password must be at least 8 characters');

export const createUserSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: passwordSchema,
  role: userRoleSchema,
  personId: personIdSchema,
  isActive: z.boolean().optional(),
  restrictedProjects: z.boolean().optional(),
});

export const updateUserSchema = z
  .object({
    email: z.string().email('Invalid email address').optional(),
    password: passwordSchema.optional(),
    role: userRoleSchema.optional(),
    personId: personIdSchema.optional(),
    isActive: z.boolean().optional(),
    restrictedProjects: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'At least one field must be provided',
  });

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export type UserPersonDto = {
  id: string;
  firstName: string;
  lastName: string;
  employeeRole: { name: string } | null;
};

/** API-facing User shape — passwordHash is never exposed. */
export type UserDto = {
  id: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  restrictedProjects: boolean;
  personId: string;
  person: UserPersonDto;
  createdAt: string;
  updatedAt: string;
};

export const USER_LIST_SORT_BY_VALUES = ['name'] as const;

export type UserListSortBy = (typeof USER_LIST_SORT_BY_VALUES)[number];
