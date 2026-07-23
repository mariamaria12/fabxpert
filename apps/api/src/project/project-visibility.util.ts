import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

/**
 * Employee project visibility for `GET /projects/available`:
 * - no linked roles → visible to everyone
 * - linked roles → visible only if the employee's person role is one of them
 * - employee with no active role → only unrestricted projects
 */
export function buildEmployeeRoleVisibilityWhere(
  employeeRoleId: string | null,
): Prisma.ProjectWhereInput {
  if (employeeRoleId) {
    return {
      OR: [
        { visibleForRoles: { none: {} } },
        { visibleForRoles: { some: { id: employeeRoleId } } },
      ],
    };
  }

  return {
    visibleForRoles: { none: {} },
  };
}

export function isProjectVisibleForEmployeeRole(
  visibleForRoleIds: string[],
  employeeRoleId: string | null,
): boolean {
  if (visibleForRoleIds.length === 0) {
    return true;
  }
  if (!employeeRoleId) {
    return false;
  }
  return visibleForRoleIds.includes(employeeRoleId);
}

/** Active, non-deleted employee-role id for the user's linked person (or null). */
export async function resolveActiveEmployeeRoleId(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      person: {
        select: {
          employeeRole: {
            select: { id: true, isActive: true, deletedAt: true },
          },
        },
      },
    },
  });

  const role = user?.person?.employeeRole;
  if (!role || !role.isActive || role.deletedAt) {
    return null;
  }

  return role.id;
}
