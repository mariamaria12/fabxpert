import type { PaginatedResponse } from '@fabxpert/shared';

const DEFAULT_PAGE_SIZE = 200;

/** Fetch every page from a paginated list API. */
export async function loadAllPages<T>(
  fetchPage: (page: number, pageSize: number) => Promise<PaginatedResponse<T>>,
  pageSize = DEFAULT_PAGE_SIZE,
): Promise<T[]> {
  const first = await fetchPage(1, pageSize);
  const items = [...first.data];

  for (let page = 2; page <= first.meta.totalPages; page += 1) {
    const response = await fetchPage(page, pageSize);
    items.push(...response.data);
  }

  return items;
}
