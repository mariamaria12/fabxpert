import { request } from './client';
import type {
  CreateTimesheetInput,
  StartTimesheetBodyInput,
  StopTimesheetInput,
  TimesheetDto,
  UpdateTimesheetInput,
} from '../dto/timesheet.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export interface ListTimesheetsParams {
  page?: number;
  pageSize?: number;
  personId?: string;
  projectId?: string;
}

export function startTimesheet(input: StartTimesheetBodyInput) {
  return request<TimesheetDto>('/timesheets/start', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function stopTimesheet(input: StopTimesheetInput = {}) {
  return request<TimesheetDto>('/timesheets/stop', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function createTimesheet(input: CreateTimesheetInput) {
  return request<TimesheetDto>('/timesheets', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listTimesheets(params: ListTimesheetsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.personId !== undefined) {
    searchParams.set('personId', params.personId);
  }
  if (params.projectId !== undefined) {
    searchParams.set('projectId', params.projectId);
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<TimesheetDto>>(`/timesheets${query ? `?${query}` : ''}`);
}

export function listMyTimesheets(page?: number, pageSize?: number) {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<TimesheetDto>>(
    `/timesheets/mine${query ? `?${query}` : ''}`,
  );
}

export function getTimesheet(id: string) {
  return request<TimesheetDto>(`/timesheets/${id}`);
}

export function updateTimesheet(id: string, input: UpdateTimesheetInput) {
  return request<TimesheetDto>(`/timesheets/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTimesheet(id: string) {
  return request<void>(`/timesheets/${id}`, { method: 'DELETE' });
}
