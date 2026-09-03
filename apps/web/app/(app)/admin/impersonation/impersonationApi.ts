/**
 * Person-scoped API adapter for impersonation.
 *
 * The copied mobile screens call these functions instead of the raw
 * `@fabxpert/shared` client. Every call runs under the *admin's* own session
 * cookie, so:
 *   - CREATE actions inject the impersonated person's `personId` (the existing
 *     admin "on behalf of" path). For timesheets the backend records
 *     `userId = admin`, which is exactly the desired audit trail.
 *   - READ actions map the employee "/mine" endpoints to the admin list
 *     endpoints filtered by `personId`.
 *   - UPDATE/DELETE pass through to the admin-capable endpoints.
 */
import {
  createLeaveRequest as sharedCreateLeaveRequest,
  createTimesheet as sharedCreateTimesheet,
  listAvailableProjects as sharedListAvailableProjects,
  cancelLeaveRequest,
  deleteTimesheet,
  getLeaveBalance,
  getOvertimeBalance,
  listLeaveRequests,
  listTimesheets,
  updateLeaveRequest,
  updateTimesheet,
} from '@fabxpert/shared';
import type {
  CreateLeaveRequestInput,
  CreateTimesheetInput,
} from '@fabxpert/shared';
import { getImpersonationPersonId } from './impersonationSession';

/** POST /timesheets with the impersonated person injected. */
export function createTimesheet(input: Omit<CreateTimesheetInput, 'personId'>) {
  return sharedCreateTimesheet({ ...input, personId: getImpersonationPersonId() });
}

/** GET the impersonated person's timesheets (admin list filtered by personId). */
export function listMyTimesheets(page?: number, pageSize?: number) {
  return listTimesheets({ personId: getImpersonationPersonId(), page, pageSize });
}

/** POST /leave-requests with the impersonated person injected. */
export function createLeaveRequest(input: Omit<CreateLeaveRequestInput, 'personId'>) {
  return sharedCreateLeaveRequest({ ...input, personId: getImpersonationPersonId() });
}

/** GET the impersonated person's leave requests (admin list filtered by personId). */
export function listMyLeaveRequests(page?: number, pageSize?: number) {
  return listLeaveRequests({ personId: getImpersonationPersonId(), page, pageSize });
}

/**
 * GET the projects the impersonated person can log time on — their employee
 * role and their "Vede doar proiecte alocate specific" flag, not the admin's.
 */
export function listAvailableProjects() {
  return sharedListAvailableProjects(getImpersonationPersonId());
}

/** GET the impersonated person's leave balance. */
export function getMyLeaveBalance() {
  return getLeaveBalance(getImpersonationPersonId());
}

/** GET the impersonated person's overtime balance. */
export function getMyOvertimeBalance() {
  return getOvertimeBalance(getImpersonationPersonId());
}

// Project assemblies are project-scoped, so there is no person to inject.
export { listProjectAssemblies } from '@fabxpert/shared';

// Update / delete are admin-capable on the shared endpoints as-is.
export { updateTimesheet, deleteTimesheet, updateLeaveRequest, cancelLeaveRequest };
