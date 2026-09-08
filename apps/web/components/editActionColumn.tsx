'use client';

import type { DataTableColumn } from '@/components/DataTable';

/** Trailing pencil column for tables where the row itself is not clickable. */
export function editActionColumn<T>(
  onEdit: (row: T) => void,
  label: string,
): DataTableColumn<T> {
  return {
    key: 'actions',
    header: '',
    width: '96px',
    className: 'overflow-visible',
    render: (row) => (
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
