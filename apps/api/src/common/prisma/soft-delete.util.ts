/** Spread into Prisma `where` clauses to exclude soft-deleted rows. */
export function notDeleted() {
  return { deletedAt: null } as const;
}
