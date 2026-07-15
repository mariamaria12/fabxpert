import { request } from './client';
import type {
  CreatePersonInput,
  PersonDto,
  PersonListSortBy,
  UpdatePersonInput,
} from '../dto/person.dto';
import type { SortOrder } from '../dto/project.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export interface ListPersonsParams {
  page?: number;
  pageSize?: number;
  sortBy?: PersonListSortBy;
  sortOrder?: SortOrder;
}

export function listPersons(params: ListPersonsParams = {}) {
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
  const query = searchParams.toString();
  return request<PaginatedResponse<PersonDto>>(`/persons${query ? `?${query}` : ''}`);
}

export function getPerson(id: string) {
  return request<PersonDto>(`/persons/${id}`);
}

export function createPerson(input: CreatePersonInput) {
  return request<PersonDto>('/persons', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePerson(id: string, input: UpdatePersonInput) {
  return request<PersonDto>(`/persons/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deletePerson(id: string) {
  return request<void>(`/persons/${id}`, { method: 'DELETE' });
}
