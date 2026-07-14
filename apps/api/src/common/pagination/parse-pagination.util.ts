export const DEFAULT_PAGE = 1;
export const DEFAULT_PAGE_SIZE = 20;
export const MAX_PAGE_SIZE = 200;

export interface PaginationParams {
  page: number;
  pageSize: number;
}

/** Invalid or missing values fall back to defaults — list endpoints must not 400 on bad pagination input. */
export function parsePagination(query: Record<string, string | undefined>): PaginationParams {
  return {
    page: parsePositiveInt(query.page, DEFAULT_PAGE),
    pageSize: Math.min(
      parsePositiveInt(query.pageSize, DEFAULT_PAGE_SIZE),
      MAX_PAGE_SIZE,
    ),
  };
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  if (value === undefined) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return parsed;
}
