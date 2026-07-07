// Public entry point for @fabxpert/shared — DTOs, enums, types, Zod schemas,
// utility functions, and the API client layer.
// See docs/architecture.md — packages/shared section — for what goes here.

export { ApiError, configureApiClient, getApiClientBaseUrl } from './api/client';
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
  ProjectStatus,
  ProjectStatusGroup,
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
  listUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
} from './api/user';
export {
  createUserSchema,
  updateUserSchema,
  USER_ROLE_VALUES,
} from './dto/user.dto';
export type {
  UserDto,
  UserRole,
  UserPersonDto,
  CreateUserInput,
  UpdateUserInput,
} from './dto/user.dto';
export {
  startTimesheet,
  stopTimesheet,
  createTimesheet,
  listTimesheets,
  listMyTimesheets,
  getTimesheet,
  updateTimesheet,
  deleteTimesheet,
  getProjectSummary,
  subscribeToTimesheets,
} from './api/timesheet';
export type {
  ListTimesheetsParams,
  TimesheetEvent,
  TimesheetEventType,
} from './api/timesheet';
export {
  startTimesheetSchema,
  startTimesheetBodySchema,
  stopTimesheetSchema,
  createTimesheetSchema,
  updateTimesheetSchema,
} from './dto/timesheet.dto';
export type {
  TimesheetDto,
  TimesheetPersonDto,
  TimesheetProjectDto,
  TimesheetActivityDto,
  ProjectSummaryPeriod,
  ProjectSummaryActivityRow,
  ProjectSummaryProjectRow,
  ProjectSummaryResponse,
  StartTimesheetInput,
  StartTimesheetBodyInput,
  StopTimesheetInput,
  CreateTimesheetInput,
  UpdateTimesheetInput,
} from './dto/timesheet.dto';
