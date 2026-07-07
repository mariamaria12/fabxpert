import { request } from './client';
import type {
  CreatePersonInput,
  PersonDto,
  UpdatePersonInput,
} from '../dto/person.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export function listPersons(page?: number, pageSize?: number) {
  const searchParams = new URLSearchParams();
  if (page !== undefined) {
    searchParams.set('page', String(page));
  }
  if (pageSize !== undefined) {
    searchParams.set('pageSize', String(pageSize));
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
