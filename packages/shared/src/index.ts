// Public entry point for @fabxpert/shared — DTOs, enums, types, Zod schemas,
// utility functions, and the API client layer.
// See docs/architecture.md — packages/shared section — for what goes here.

export { ApiError, configureApiClient, getApiClientBaseUrl } from './api/client';
export { resolveApiBaseUrl } from './api/resolve-api-base-url';
export { getMe, login, logout } from './api/auth';
export type { MeResponse } from './api/auth';
export {
  listCompanies,
  getCompany,
  createCompany,
  updateCompany,
  deleteCompany,
} from './api/companies';
export type { ListCompaniesParams } from './api/companies';
export {
  createCompanySchema,
  updateCompanySchema,
} from './dto/company.dto';
export type {
  CompanyDto,
  CompanyListSortBy,
  CreateCompanyInput,
  UpdateCompanyInput,
} from './dto/company.dto';
export type { PaginatedResponse, PaginationMeta } from './dto/pagination.dto';
export {
  listActivities,
  getActivity,
  createActivity,
  updateActivity,
  deleteActivity,
} from './api/activity';
export {
  createActivitySchema,
  updateActivitySchema,
} from './dto/activity.dto';
export type {
  ActivityDto,
  CreateActivityInput,
  UpdateActivityInput,
} from './dto/activity.dto';
export {
  listEmployeeRoles,
  getEmployeeRole,
  createEmployeeRole,
  updateEmployeeRole,
  deleteEmployeeRole,
} from './api/employee-role';
export {
  createEmployeeRoleSchema,
  updateEmployeeRoleSchema,
} from './dto/employee-role.dto';
export type {
  EmployeeRoleDto,
  CreateEmployeeRoleInput,
  UpdateEmployeeRoleInput,
} from './dto/employee-role.dto';
export {
  listPersons,
  getPerson,
  createPerson,
  updatePerson,
  deletePerson,
} from './api/person';
export {
  createPersonSchema,
  updatePersonSchema,
} from './dto/person.dto';
export type {
  PersonDto,
  PersonEmployeeRoleDto,
  CreatePersonInput,
  UpdatePersonInput,
} from './dto/person.dto';
export type { ListProjectsParams } from './api/project';
export {
  listProjects,
  listAvailableProjects,
  getProject,
  createProject,
  updateProject,
  deleteProject,
  subscribeToAvailableProjects,
} from './api/project';
export type { ProjectAvailabilityEvent } from './api/project';
export {
  createProjectSchema,
  updateProjectSchema,
  PROJECT_STATUS_VALUES,
} from './dto/project.dto';
export type {
  ProjectDto,
  ProjectCompanyDto,
  ProjectOptionDto,
  ProjectVisibleRoleDto,
  ProjectStatus,
  ProjectStatusGroup,
  ProjectListSortBy,
  SortOrder,
  PROJECT_LIST_SORT_BY_VALUES,
  SORT_ORDER_VALUES,
  CreateProjectInput,
  UpdateProjectInput,
} from './dto/project.dto';
export {
  PROJECT_STATUS_META,
  PROJECT_TERMINAL_STATUSES,
  formatProjectDueDate,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
} from './projectStatus';
export type { ProjectStatusMeta } from './projectStatus';
export {
  type Period,
  type PeriodQueryParams,
  periodToQuery,
  isPeriodQueryReady,
  periodsEqual,
} from './period';
export {
  formatRomanianDayMonth,
  formatRomanianMonthName,
  formatRomanianDayMonthRange,
  formatCustomPeriodSubLabel,
  formatPeriodCardSubLabel,
} from './periodDisplay';
export {
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from './api/user';
export type { ListUsersParams } from './api/user';
export {
  createUserSchema,
  updateUserSchema,
  USER_ROLE_VALUES,
} from './dto/user.dto';
export type {
  UserDto,
  UserRole,
  UserPersonDto,
  UserListSortBy,
  CreateUserInput,
  UpdateUserInput,
} from './dto/user.dto';
export {
  createTimesheet,
  listTimesheets,
  listMyTimesheets,
  getTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getProjectSummary,
  getPersonSummary,
  getDashboardMetrics,
  exportTimesheetsXlsx,
  subscribeToTimesheets,
} from './api/timesheet';
export type {
  ListTimesheetsParams,
  ExportTimesheetsParams,
  TimesheetEvent,
  TimesheetEventType,
} from './api/timesheet';
export {
  createTimesheetSchema,
  updateTimesheetSchema,
} from './dto/timesheet.dto';
export type {
  TimesheetDto,
  TimesheetPersonDto,
  TimesheetProjectDto,
  TimesheetActivityDto,
  TimesheetSummaryPeriod,
  TimesheetSummaryParams,
  ProjectSummaryPeriod,
  ProjectSummaryActivityRow,
  ProjectSummaryProjectRow,
  ProjectSummaryResponse,
  PersonSummaryActivityRow,
  PersonSummaryPersonRow,
  PersonSummaryResponse,
  DashboardMetricsResponse,
  CreateTimesheetInput,
  UpdateTimesheetInput,
} from './dto/timesheet.dto';
export {
  normalizeWorkDate,
  parseWorkDateString,
  todayWorkDate,
  todayDateInputValue,
  workDateToDayKey,
  isSameWorkDate,
} from './workDate';
export {
  countInclusiveLeaveDays,
  leaveRequestYear,
} from './leaveDays';
export {
  LEAVE_TYPE_OPTIONS,
  getLeaveTypeLabel,
  getLeaveStatusLabel,
  formatLeaveDayCount,
  formatLeaveDateRange,
} from './leaveLabels';
export {
  createLeaveRequest,
  listMyLeaveRequests,
  getMyLeaveBalance,
  updateLeaveRequest,
  cancelLeaveRequest,
  listLeaveRequests,
  getOnLeave,
  getOnLeaveToday,
  getLeaveRequest,
  reviewLeaveRequest,
  getLeaveBalance,
  listLeaveBalances,
} from './api/leave';
export type { ListLeaveRequestsParams } from './api/leave';
export {
  createLeaveRequestSchema,
  updateLeaveRequestSchema,
  reviewLeaveRequestSchema,
  LEAVE_TYPE_VALUES,
  LEAVE_STATUS_VALUES,
} from './dto/leave.dto';
export type {
  LeaveType,
  LeaveStatus,
  LeaveRequestDto,
  LeaveRequestPersonDto,
  LeaveRequestReviewerDto,
  LeaveBalanceDto,
  LeaveBalanceRowDto,
  LeaveBalancesResponse,
  EmployeeLeaveRequestResponse,
  ReviewLeaveRequestResponse,
  OnLeaveResponse,
  OnLeaveTodayResponse,
  CreateLeaveRequestInput,
  UpdateLeaveRequestInput,
  ReviewLeaveRequestInput,
} from './dto/leave.dto';
