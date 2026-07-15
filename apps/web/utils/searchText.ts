/** Case- and diacritic-insensitive text for client-side filtering. */
export function normalizeSearchText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim();
}

export function matchesSearchText(haystack: string, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) {
    return true;
  }
  return normalizeSearchText(haystack).includes(normalizedQuery);
}

/** Exact match for resolving pasted client names against the company list. */
export function equalsSearchText(left: string, right: string): boolean {
  return normalizeSearchText(left) === normalizeSearchText(right);
}
