import { request } from './client';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserDto,
  UserListSortBy,
} from '../dto/user.dto';
import type { SortOrder } from '../dto/project.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export interface ListUsersParams {
  page?: number;
  pageSize?: number;
  sortBy?: UserListSortBy;
  sortOrder?: SortOrder;
  search?: string;
}

export function listUsers(params: ListUsersParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }
  if (params.search?.trim()) {
    searchParams.set('search', params.search.trim());
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<UserDto>>(`/users${query ? `?${query}` : ''}`);
}

export function getUser(id: string) {
  return request<UserDto>(`/users/${id}`);
}

export function createUser(input: CreateUserInput) {
  return request<UserDto>('/users', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateUser(id: string, input: UpdateUserInput) {
  return request<UserDto>(`/users/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteUser(id: string) {
  return request<void>(`/users/${id}`, { method: 'DELETE' });
}
