'use client';

import type { DataTableColumn } from '@/components/DataTable';

/**
 * Trailing pencil column for tables where the row itself is not clickable.
 * `isEditable` leaves the cell empty on rows with nothing to edit.
 */
export function editActionColumn<T>(
  onEdit: (row: T) => void,
  label: string,
  isEditable: (row: T) => boolean = () => true,
): DataTableColumn<T> {
  return {
    key: 'actions',
    header: '',
    width: '96px',
    className: 'overflow-visible',
    render: (row) =>
      !isEditable(row) ? null : (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label={label}
            title={label}
            onClick={(event) => {
              event.stopPropagation();
              onEdit(row);
            }}
            className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
          >
            <i className="ti ti-pencil text-base" aria-hidden="true" />
          </button>
        </div>
      ),
  };
}
