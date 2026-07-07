import { request } from './client';
import type {
  CompanyDto,
  CreateCompanyInput,
  UpdateCompanyInput,
} from '../dto/company.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export interface ListCompaniesParams {
  page?: number;
  pageSize?: number;
  search?: string;
}

export function listCompanies(params: ListCompaniesParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    searchParams.set('search', trimmedSearch);
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<CompanyDto>>(`/companies${query ? `?${query}` : ''}`);
}

export function getCompany(id: string) {
  return request<CompanyDto>(`/companies/${id}`);
}

export function createCompany(input: CreateCompanyInput) {
  return request<CompanyDto>('/companies', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateCompany(id: string, input: UpdateCompanyInput) {
  return request<CompanyDto>(`/companies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteCompany(id: string) {
  return request<void>(`/companies/${id}`, { method: 'DELETE' });
}
