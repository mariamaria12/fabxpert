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

/** Call after admin mutates companies or employee roles if dropdowns must refresh. */
export function invalidateProjectFormLookups(): void {
  companiesCache.data = null;
  companiesCache.inflight = null;
  employeeRolesCache.data = null;
  employeeRolesCache.inflight = null;
}
