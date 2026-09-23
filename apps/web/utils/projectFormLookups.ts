import {
  listCompanies,
  listEmployeeRoles,
  type CompanyDto,
  type EmployeeRoleDto,
} from '@fabxpert/shared';
import { loadAllPages } from './loadAllPages';

const LOOKUP_PAGE_SIZE = 200;

const companiesInflight: { promise: Promise<CompanyDto[]> | null } = { promise: null };
const employeeRolesInflight: { promise: Promise<EmployeeRoleDto[]> | null } = { promise: null };

/**
 * Deduplicates concurrent fetches (e.g. React StrictMode double-mount in dev),
 * without keeping the result: a company or role added meanwhile — here, on the
 * admin pages, or by someone else — has to show up the next time a dropdown
 * opens, and a session-long cache outlived even a logout.
 */
function dedupe<T>(inflight: { promise: Promise<T> | null }, fetcher: () => Promise<T>): Promise<T> {
  if (inflight.promise) {
    return inflight.promise;
  }

  const promise = fetcher().finally(() => {
    if (inflight.promise === promise) {
      inflight.promise = null;
    }
  });

  inflight.promise = promise;
  return promise;
}

export function getProjectFormCompanies(): Promise<CompanyDto[]> {
  return dedupe(companiesInflight, () =>
    loadAllPages((page, pageSize) => listCompanies({ page, pageSize }), LOOKUP_PAGE_SIZE),
  );
}

export function getProjectFormEmployeeRoles(): Promise<EmployeeRoleDto[]> {
  return dedupe(employeeRolesInflight, () => listEmployeeRoles());
}

function sortCompanies(companies: CompanyDto[]): CompanyDto[] {
  return [...companies].sort((left, right) => left.name.localeCompare(right.name, 'ro'));
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
