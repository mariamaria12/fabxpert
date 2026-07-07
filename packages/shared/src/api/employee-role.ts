import { request } from './client';
import type {
  CreateEmployeeRoleInput,
  EmployeeRoleDto,
  UpdateEmployeeRoleInput,
} from '../dto/employee-role.dto';

export function listEmployeeRoles(includeInactive?: boolean) {
  const searchParams = new URLSearchParams();
  if (includeInactive === true) {
    searchParams.set('includeInactive', 'true');
  }
  const query = searchParams.toString();
  return request<EmployeeRoleDto[]>(`/employee-roles${query ? `?${query}` : ''}`);
}

export function getEmployeeRole(id: string) {
  return request<EmployeeRoleDto>(`/employee-roles/${id}`);
}

export function createEmployeeRole(input: CreateEmployeeRoleInput) {
  return request<EmployeeRoleDto>('/employee-roles', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateEmployeeRole(id: string, input: UpdateEmployeeRoleInput) {
  return request<EmployeeRoleDto>(`/employee-roles/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteEmployeeRole(id: string) {
  return request<void>(`/employee-roles/${id}`, { method: 'DELETE' });
}
