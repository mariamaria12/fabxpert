import { request } from './client';
import type {
  CreateProjectInput,
  ProjectDto,
  UpdateProjectInput,
} from '../dto/project.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export function listProjects(page?: number, pageSize?: number) {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<ProjectDto>>(`/projects${query ? `?${query}` : ''}`);
}

export function getProject(id: string) {
  return request<ProjectDto>(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput) {
  return request<ProjectDto>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return request<ProjectDto>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}
