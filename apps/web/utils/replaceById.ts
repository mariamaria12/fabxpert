/** Swap one list item by id in place — no re-sort, no refetch. */
export function replaceById<T extends { id: string }>(
  items: readonly T[],
  updated: T,
): T[] {
  const index = items.findIndex((item) => item.id === updated.id);
  if (index === -1) {
    return [...items];
  }

  const next = [...items];
  next[index] = updated;
  return next;
}

/** Remove one list item by id; returns whether a row was removed. */
export function removeById<T extends { id: string }>(
  items: readonly T[],
  id: string,
): { items: T[]; removed: boolean } {
  const index = items.findIndex((item) => item.id === id);
  if (index === -1) {
    return { items: [...items], removed: false };
  }

  return {
    items: items.filter((item) => item.id !== id),
    removed: true,
  };
}
