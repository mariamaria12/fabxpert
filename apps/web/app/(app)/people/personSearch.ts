import type { PersonDto } from '@fabxpert/shared';

/** TODO: switch to server-side ?search= when Person list API supports it. */
export function personMatchesSearch(person: PersonDto, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return true;
  }

  const fullName = `${person.firstName} ${person.lastName}`.toLowerCase();
  const fields = [
    fullName,
    person.firstName.toLowerCase(),
    person.lastName.toLowerCase(),
    person.email?.toLowerCase() ?? '',
    person.phone?.toLowerCase() ?? '',
    person.employeeRole?.name.toLowerCase() ?? '',
  ];

  return fields.some((field) => field.includes(normalizedQuery));
}

export function paginateSlice<T>(items: T[], page: number, pageSize: number): T[] {
  const start = (page - 1) * pageSize;
  return items.slice(start, start + pageSize);
}

/** Max rows fetched for client-side search until API search exists. */
export const CLIENT_SEARCH_FETCH_SIZE = 500;
