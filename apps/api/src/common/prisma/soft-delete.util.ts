/** Spread into Prisma `where` clauses to exclude soft-deleted rows. */
export function notDeleted() {
  return { deletedAt: null } as const;
}

/** Timesheets visible in lists, exports, and dashboard aggregations. */
export function visibleTimesheetWhere() {
  return {
    ...notDeleted(),
    project: notDeleted(),
    person: notDeleted(),
  } as const;
}
