import { getApiClientBaseUrl, request } from './client';
import type {
  CreateTimesheetInput,
  DashboardMetricsResponse,
  PersonSummaryResponse,
  ProjectSummaryResponse,
  TimesheetDto,
  UpdateTimesheetInput,
} from '../dto/timesheet.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';
import { isPeriodQueryReady, periodToQuery, type Period } from '../period';

export type TimesheetEventType = 'created' | 'updated' | 'deleted';

export type TimesheetEvent = {
  type: TimesheetEventType;
  id: string;
  personName: string;
};

export interface ListTimesheetsParams {
  page?: number;
  pageSize?: number;
  personId?: string;
  projectId?: string;
  period?: Period;
  /** @deprecated Prefer `period`. Kept for createdAt-based filtering. */
  createdAtFrom?: string;
  /** @deprecated Prefer `period`. Kept for createdAt-based filtering. */
  createdAtTo?: string;
}

function appendPeriodQuery(searchParams: URLSearchParams, period: Period): void {
  const query = periodToQuery(period);
  searchParams.set('period', query.period);
  if (query.from?.trim()) {
    searchParams.set('from', query.from.trim());
  }
  if (query.to?.trim()) {
    searchParams.set('to', query.to.trim());
  }
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
  if (params.period !== undefined && isPeriodQueryReady(params.period)) {
    appendPeriodQuery(searchParams, params.period);
  }
  if (params.createdAtFrom !== undefined) {
    searchParams.set('createdAtFrom', params.createdAtFrom);
  }
  if (params.createdAtTo !== undefined) {
    searchParams.set('createdAtTo', params.createdAtTo);
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

export function getProjectSummary(period: Period = { kind: 'today' }) {
  const searchParams = new URLSearchParams();
  appendPeriodQuery(searchParams, period);
  return request<ProjectSummaryResponse>(
    `/timesheets/project-summary?${searchParams.toString()}`,
  );
}

export function getPersonSummary(period: Period = { kind: 'today' }) {
  const searchParams = new URLSearchParams();
  appendPeriodQuery(searchParams, period);
  return request<PersonSummaryResponse>(
    `/timesheets/person-summary?${searchParams.toString()}`,
  );
}

export function getDashboardMetrics() {
  return request<DashboardMetricsResponse>('/timesheets/dashboard-metrics');
}

function isTimesheetEvent(value: unknown): value is TimesheetEvent {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  return (
    (record.type === 'created' ||
      record.type === 'updated' ||
      record.type === 'deleted') &&
    typeof record.id === 'string' &&
    typeof record.personName === 'string'
  );
}

/**
 * Subscribe to live timesheet events (ADMIN SSE stream).
 * Returns an unsubscribe function that closes the EventSource.
 */
export function subscribeToTimesheets(
  onEvent: (event: TimesheetEvent) => void,
  onError?: (error: Event) => void,
): () => void {
  const source = new EventSource(`${getApiClientBaseUrl()}/timesheets/stream`, {
    withCredentials: true,
  });

  source.onmessage = (message) => {
    try {
      const parsed: unknown = JSON.parse(message.data);
      if (isTimesheetEvent(parsed)) {
        onEvent(parsed);
      }
    } catch {
      // Ignore malformed SSE payloads.
    }
  };

  source.onerror = (error) => {
    onError?.(error);
  };

  return () => {
    source.close();
  };
}
