import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  /** Unique column identifier; also used for default cell value lookup on row. */
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Optional width hint, e.g. "120px" or "20%". */
  width?: string;
  className?: string;
  /** API sortBy value — when set, header is clickable if onSortChange is provided. */
  sortKey?: string;
}

export type DataTableSortOrder = 'asc' | 'desc';

export interface DataTableProps<T> {
  columns: DataTableColumn<T>[];
  /** Current page rows — already fetched/sliced by the parent. */
  data: T[];
  rowKey: (row: T) => string | number;
  /** When provided, renders a 6px colored bar as the leading column (Projects-style). */
  rowAccentColor?: (row: T) => string | undefined;
  /** When set, rows become clickable (pointer + hover). */
  onRowClick?: (row: T) => void;
  /** Renders skeleton placeholder rows instead of data. */
  loading?: boolean;
  /** Skeleton row count when loading (default 5). */
  loadingRowCount?: number;
  /** Message shown in the table body when not loading and data is empty. */
  emptyMessage?: string;
  /** Active server-side sort column (API sortBy). */
  sortBy?: string | null;
  sortOrder?: DataTableSortOrder;
  /** Called when a sortable header is clicked — parent refetches with new sort. */
  onSortChange?: (sortBy: string, sortOrder: DataTableSortOrder) => void;
}

function getCellValue<T>(row: T, key: string): ReactNode {
  const record = row as Record<string, unknown>;
  const value = record[key];
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

function SkeletonCell() {
  return (
    <div className="h-3.5 w-3/4 max-w-[12rem] animate-pulse rounded bg-surface-raised" />
  );
}

export function DataTableSortIcon({
  active,
  order,
}: {
  active: boolean;
  order: DataTableSortOrder;
}) {
  return (
    <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center">
      {active ? (
        <i
          className={`ti ${order === 'asc' ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm text-accent`}
          aria-hidden="true"
        />
      ) : (
        <i className="ti ti-arrows-sort text-sm text-text-muted/60" aria-hidden="true" />
      )}
    </span>
  );
}

function SortIcon({ active, order }: { active: boolean; order: DataTableSortOrder }) {
  return <DataTableSortIcon active={active} order={order} />;
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  rowAccentColor,
  onRowClick,
  loading = false,
  loadingRowCount = 5,
  emptyMessage = 'Niciun rezultat.',
  sortBy = null,
  sortOrder = 'asc',
  onSortChange,
}: DataTableProps<T>) {
  const showAccent = rowAccentColor !== undefined;
  const colSpan = columns.length + (showAccent ? 1 : 0);
  const interactive = onRowClick !== undefined;

  function handleSortClick(columnSortKey: string) {
    if (!onSortChange) {
      return;
    }

    if (sortBy !== columnSortKey) {
      onSortChange(columnSortKey, 'asc');
      return;
    }

    onSortChange(columnSortKey, sortOrder === 'asc' ? 'desc' : 'asc');
  }

  return (
    <div className="w-full overflow-x-auto border border-border-subtle">
      <table className="w-full table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {showAccent && <th className="w-1.5 p-0" aria-hidden="true" />}
            {columns.map((column) => {
              const isSortable = Boolean(column.sortKey && onSortChange);
              const isActive = isSortable && sortBy === column.sortKey;
              const ariaSort = isActive
                ? sortOrder === 'asc'
                  ? 'ascending'
                  : 'descending'
                : isSortable
                  ? 'none'
                  : undefined;

              return (
                <th
                  key={column.key}
                  scope="col"
                  aria-sort={ariaSort}
                  style={column.width ? { width: column.width } : undefined}
                  className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-muted ${column.className ?? ''}`}
                >
                  {isSortable ? (
                    <button
                      type="button"
                      onClick={() => handleSortClick(column.sortKey!)}
                      className={`flex w-full min-w-0 items-center gap-1 rounded text-left transition-colors hover:text-text-secondary${
                        isActive ? ' text-accent' : ''
                      }`}
                    >
                      <span className="min-w-0 truncate">{column.header}</span>
                      <SortIcon active={isActive} order={sortOrder} />
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            Array.from({ length: loadingRowCount }, (_, index) => (
              <tr
                key={`skeleton-${index}`}
                className="border-b border-border-subtle last:border-b-0"
              >
                {showAccent && <td className="w-1.5 p-0" aria-hidden="true" />}
                {columns.map((column) => (
                  <td key={column.key} className="px-3 py-2.5">
                    <SkeletonCell />
                  </td>
                ))}
              </tr>
            ))
          ) : data.length === 0 ? (
            <tr>
              <td colSpan={colSpan} className="px-3 py-8 text-center text-text-muted">
                {emptyMessage}
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const accent = showAccent ? rowAccentColor(row) : undefined;
              return (
                <tr
                  key={rowKey(row)}
                  onClick={interactive ? () => onRowClick(row) : undefined}
                  className={`border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-raised${
                    interactive ? ' cursor-pointer' : ''
                  }`}
                >
                  {showAccent && (
                    <td className="w-1.5 p-0" aria-hidden="true">
                      {accent && (
                        <div className="h-full min-h-[40px] w-1.5" style={{ backgroundColor: accent }} />
                      )}
                    </td>
                  )}
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      style={column.width ? { width: column.width } : undefined}
                      className={`px-3 py-2 text-text-primary ${column.className ?? ''}`}
                    >
                      {column.render ? column.render(row) : getCellValue(row, column.key)}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
