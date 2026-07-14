import { request } from './client';
import type { PaginatedResponse } from '../dto/pagination.dto';
import type {
  CreateLeaveRequestInput,
  EmployeeLeaveRequestResponse,
  LeaveBalanceDto,
  LeaveRequestDto,
  LeaveStatus,
  ReviewLeaveRequestInput,
  ReviewLeaveRequestResponse,
  UpdateLeaveRequestInput,
} from '../dto/leave.dto';

export type ListLeaveRequestsParams = {
  status?: LeaveStatus;
  personId?: string;
  page?: number;
  pageSize?: number;
};

function buildListQuery(params?: ListLeaveRequestsParams): string {
  if (!params) {
    return '';
  }
  const searchParams = new URLSearchParams();
  if (params.status !== undefined) {
    searchParams.set('status', params.status);
  }
  if (params.personId !== undefined) {
    searchParams.set('personId', params.personId);
  }
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function createLeaveRequest(input: CreateLeaveRequestInput) {
  return request<EmployeeLeaveRequestResponse>('/leave-requests', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function listMyLeaveRequests(page?: number, pageSize?: number) {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<LeaveRequestDto>>(
    `/leave-requests/mine${query ? `?${query}` : ''}`,
  );
}

export function getMyLeaveBalance() {
  return request<LeaveBalanceDto>('/leave-requests/my-balance');
}

export function updateLeaveRequest(id: string, input: UpdateLeaveRequestInput) {
  return request<EmployeeLeaveRequestResponse>(`/leave-requests/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function cancelLeaveRequest(id: string) {
  return request<void>(`/leave-requests/${id}`, { method: 'DELETE' });
}

export function listLeaveRequests(params?: ListLeaveRequestsParams) {
  return request<PaginatedResponse<LeaveRequestDto>>(
    `/leave-requests${buildListQuery(params)}`,
  );
}

export function getLeaveRequest(id: string) {
  return request<LeaveRequestDto>(`/leave-requests/${id}`);
}

export function reviewLeaveRequest(id: string, input: ReviewLeaveRequestInput) {
  return request<ReviewLeaveRequestResponse>(`/leave-requests/${id}/review`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function getLeaveBalance(personId: string) {
  return request<LeaveBalanceDto>(`/leave-requests/balance/${personId}`);
}
