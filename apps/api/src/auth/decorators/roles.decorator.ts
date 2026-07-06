import { SetMetadata } from '@nestjs/common';

export type AppRole = 'ADMIN' | 'EMPLOYEE';

export const ROLES_KEY = 'roles';

/** Restrict a route to one or more roles. Requires AuthGuard to run first. */
export const Roles = (...roles: AppRole[]) => SetMetadata(ROLES_KEY, roles);
