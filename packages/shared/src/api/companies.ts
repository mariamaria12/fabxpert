import { request } from './client';
import type {
  CompanyDto,
  CompanyImportResult,
  CompanyListSortBy,
  CreateCompanyInput,
  ImportCompaniesInput,
  UpdateCompanyInput,
} from '../dto/company.dto';
import type { SortOrder } from '../dto/project.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export interface ListCompaniesParams {
  page?: number;
  pageSize?: number;
  search?: string;
  sortBy?: CompanyListSortBy;
  sortOrder?: SortOrder;
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
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
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

export function importCompanies(input: ImportCompaniesInput) {
  return request<CompanyImportResult>('/companies/import', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
