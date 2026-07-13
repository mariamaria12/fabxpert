import type { ReactNode } from 'react';

export interface DataTableColumn<T> {
  /** Unique column identifier; also used for default cell value lookup on row. */
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  /** Optional width hint, e.g. "120px" or "20%". */
  width?: string;
  className?: string;
}

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

export function DataTable<T>({
  columns,
  data,
  rowKey,
  rowAccentColor,
  onRowClick,
  loading = false,
  loadingRowCount = 5,
  emptyMessage = 'Niciun rezultat.',
}: DataTableProps<T>) {
  const showAccent = rowAccentColor !== undefined;
  const colSpan = columns.length + (showAccent ? 1 : 0);
  const interactive = onRowClick !== undefined;

  return (
    <div className="w-full overflow-x-auto border border-border-subtle">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface">
            {showAccent && <th className="w-1.5 p-0" aria-hidden="true" />}
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                style={column.width ? { width: column.width } : undefined}
                className={`px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-muted ${column.className ?? ''}`}
              >
                {column.header}
              </th>
            ))}
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
