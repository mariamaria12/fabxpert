import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';

/** Enough for ProjectFormPanel to open immediately; full data is fetched inside the panel. */
export function pinnedSummaryToProjectStub(row: PinnedProjectSummaryRow): ProjectDto {
  return {
    id: row.id,
    name: row.name,
    code: row.code,
    status: row.status,
    startDate: row.startDate,
    dueDate: row.dueDate,
    readyForExecution: false,
    isPinned: true,
    indexPanou: row.indexPanou,
    panouColumn: row.panouColumn,
    color: row.color,
    companyId: row.company.id,
    company: row.company,
    visibleForRoles: [],
    createdAt: '',
    updatedAt: '',
  };
}
