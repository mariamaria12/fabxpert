import { Prisma } from '@prisma/client';
import type { PrismaClient } from '@prisma/client';

export type EmployeeProjectVisibilityContext = {
  employeeRoleId: string | null;
  restrictedProjects: boolean;
};

/**
 * Employee project visibility for `GET /projects/available`:
 * - readyForExecution = true
 * - default: no linked roles → visible to everyone; linked roles → own role must match
 * - restrictedProjects: only projects that explicitly include the employee's role
 *   (unrestricted "Toți" projects are hidden; no role → no projects)
 */
export function buildEmployeeRoleVisibilityWhere(
  employeeRoleId: string | null,
  restrictedProjects = false,
): Prisma.ProjectWhereInput {
  if (restrictedProjects) {
    if (!employeeRoleId) {
      return { id: { in: [] } };
    }
    return {
      visibleForRoles: { some: { id: employeeRoleId } },
    };
  }

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
  restrictedProjects = false,
): boolean {
  if (restrictedProjects) {
    if (!employeeRoleId || visibleForRoleIds.length === 0) {
      return false;
    }
    return visibleForRoleIds.includes(employeeRoleId);
  }

  if (visibleForRoleIds.length === 0) {
    return true;
  }
  if (!employeeRoleId) {
    return false;
  }
  return visibleForRoleIds.includes(employeeRoleId);
}

export async function resolveEmployeeProjectVisibility(
  prisma: PrismaClient,
  userId: string,
): Promise<EmployeeProjectVisibilityContext> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      restrictedProjects: true,
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
  const employeeRoleId =
    role && role.isActive && !role.deletedAt ? role.id : null;

  return {
    employeeRoleId,
    restrictedProjects: user?.restrictedProjects === true,
  };
}

/**
 * Same context, resolved from a Person instead of the caller.
 * Used by admin-only flows that act on behalf of someone else (impersonation),
 * where the caller's own visibility is irrelevant.
 */
export async function resolvePersonProjectVisibility(
  prisma: PrismaClient,
  personId: string,
): Promise<EmployeeProjectVisibilityContext> {
  const person = await prisma.person.findUnique({
    where: { id: personId },
    select: {
      employeeRole: {
        select: { id: true, isActive: true, deletedAt: true },
      },
      user: {
        select: { restrictedProjects: true, deletedAt: true },
      },
    },
  });

  const role = person?.employeeRole;
  const employeeRoleId =
    role && role.isActive && !role.deletedAt ? role.id : null;
  const user = person?.user;

  return {
    employeeRoleId,
    restrictedProjects: !!user && !user.deletedAt && user.restrictedProjects,
  };
}

/** Active, non-deleted employee-role id for the user's linked person (or null). */
export async function resolveActiveEmployeeRoleId(
  prisma: PrismaClient,
  userId: string,
): Promise<string | null> {
  const context = await resolveEmployeeProjectVisibility(prisma, userId);
  return context.employeeRoleId;
}
