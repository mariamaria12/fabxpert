import { request } from './client';
import type {
  CreateUserInput,
  UpdateUserInput,
  UserDto,
} from '../dto/user.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export function listUsers(page?: number, pageSize?: number) {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
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
