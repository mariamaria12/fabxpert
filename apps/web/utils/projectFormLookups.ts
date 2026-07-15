import {
  listCompanies,
  listEmployeeRoles,
  type CompanyDto,
  type EmployeeRoleDto,
} from '@fabxpert/shared';
import { loadAllPages } from './loadAllPages';

const LOOKUP_PAGE_SIZE = 200;

type LookupCache<T> = {
  data: T | null;
  inflight: Promise<T> | null;
};

const companiesCache: LookupCache<CompanyDto[]> = { data: null, inflight: null };
const employeeRolesCache: LookupCache<EmployeeRoleDto[]> = { data: null, inflight: null };

/**
 * Deduplicates concurrent fetches (e.g. React StrictMode double-mount in dev) and
 * caches results for the session — companies/roles change rarely.
 */
function getOrFetch<T>(cache: LookupCache<T>, fetcher: () => Promise<T>): Promise<T> {
  if (cache.data !== null) {
    return Promise.resolve(cache.data);
  }

  if (cache.inflight) {
    return cache.inflight;
  }

  const promise = fetcher()
    .then((data) => {
      cache.data = data;
      return data;
    })
    .finally(() => {
      if (cache.inflight === promise) {
        cache.inflight = null;
      }
    });

  cache.inflight = promise;
  return promise;
}

export function getProjectFormCompanies(): Promise<CompanyDto[]> {
  return getOrFetch(companiesCache, () =>
    loadAllPages((page, pageSize) => listCompanies({ page, pageSize }), LOOKUP_PAGE_SIZE),
  );
}

export function getProjectFormEmployeeRoles(): Promise<EmployeeRoleDto[]> {
  return getOrFetch(employeeRolesCache, () => listEmployeeRoles());
}

function sortCompanies(companies: CompanyDto[]): CompanyDto[] {
  return [...companies].sort((left, right) => left.name.localeCompare(right.name, 'ro'));
}

/** Keep session cache in sync after quick-add from the project form. */
export function mergeProjectFormCompany(company: CompanyDto): void {
  if (companiesCache.data === null) {
    return;
  }

  if (companiesCache.data.some((entry) => entry.id === company.id)) {
    return;
  }

  companiesCache.data = sortCompanies([...companiesCache.data, company]);
}

/** Ensures a project-linked company appears in dropdown options (minimal stub if needed). */
export function companyOptionFromProjectCompany(company: {
  id: string;
  name: string;
}): CompanyDto {
  return {
    id: company.id,
    name: company.name,
    taxCode: null,
    tradeRegistryNumber: null,
    registeredAddress: null,
    phone: null,
    deliveryAddress: null,
    legalRepresentative: null,
    email: null,
    contactPerson: null,
    contactPersonPhone: null,
    color: null,
    createdAt: '',
    updatedAt: '',
  };
}

export function withProjectCompanyOption(
  companies: CompanyDto[],
  projectCompany: { id: string; name: string } | undefined,
): CompanyDto[] {
  if (!projectCompany || companies.some((entry) => entry.id === projectCompany.id)) {
    return companies;
  }

  return sortCompanies([...companies, companyOptionFromProjectCompany(projectCompany)]);
}

/** Call after admin mutates companies or employee roles if dropdowns must refresh. */
export function invalidateProjectFormLookups(): void {
  companiesCache.data = null;
  companiesCache.inflight = null;
  employeeRolesCache.data = null;
  employeeRolesCache.inflight = null;
}
