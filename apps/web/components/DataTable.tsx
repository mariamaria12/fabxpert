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
}

function getCellValue<T>(row: T, key: string): ReactNode {
  const record = row as Record<string, unknown>;
  const value = record[key];
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
}

export function DataTable<T>({ columns, data, rowKey, rowAccentColor }: DataTableProps<T>) {
  const showAccent = rowAccentColor !== undefined;

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
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length + (showAccent ? 1 : 0)}
                className="px-3 py-8 text-center text-text-muted"
              >
                Niciun rezultat.
              </td>
            </tr>
          ) : (
            data.map((row) => {
              const accent = showAccent ? rowAccentColor(row) : undefined;
              return (
                <tr
                  key={rowKey(row)}
                  className="border-b border-border-subtle transition-colors last:border-b-0 hover:bg-surface-raised"
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
