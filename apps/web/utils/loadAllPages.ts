import type { PaginatedResponse } from '@fabxpert/shared';

const DEFAULT_PAGE_SIZE = 200;

/**
 * Fetch every page from a paginated list API.
 *
 * The first page reports how many there are; the rest are fetched together,
 * because waiting for page 2 before asking for page 3 makes the caller pay one
 * full round trip per page.
 */
export async function loadAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);

  const remaining: Promise<PaginatedResponse<T>>[] = [];
  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    remaining.push(fetchPage(page, pageSize));
  }

  const rest = await Promise.all(remaining);
  return [...first.data, ...rest.flatMap((response) => response.data)];
}
