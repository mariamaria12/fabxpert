'use client';

import type { ProjectDto } from '@fabxpert/shared';
import type { DataTableColumn } from '@/components/DataTable';

const ACTION_BUTTON_CLASS =
  'rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary';

/**
 * Trailing column: the project report that Rapoarte opens, then the pencil,
 * which stays last so it lines up on every row.
 */
export function projectActionsColumn(
  onEdit: (project: ProjectDto) => void,
  onOpenReport: (projectId: string) => void,
): DataTableColumn<ProjectDto> {
  return {
    key: 'actions',
    header: '',
    width: '96px',
    className: 'overflow-visible',
    render: (row) => (
      <div className="flex justify-end gap-1">
        <button
          type="button"
          aria-label="Deschide fișa proiectului"
          title="Deschide fișa proiectului"
          onClick={(event) => {
            event.stopPropagation();
            onOpenReport(row.id);
          }}
          className={ACTION_BUTTON_CLASS}
        >
          <i className="ti ti-report-analytics text-base" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="Editează proiectul"
          title="Editează proiectul"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(row);
          }}
          className={ACTION_BUTTON_CLASS}
        >
          <i className="ti ti-pencil text-base" aria-hidden="true" />
        </button>
      </div>
    ),
  };
}
