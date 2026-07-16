'use client';

import { memo, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useColumnPreferences } from '@/hooks/useColumnPreferences';
import type { ColumnPreference } from '@/utils/columnStorage';

export interface DataTableColumn<T> {
  key: string;
  header: string;
  render?: (row: T) => ReactNode;
  width?: string;
  className?: string;
  sortKey?: string;
  hideable?: boolean;
}

export type DataTableSortOrder = 'asc' | 'desc';

export interface DataTableProps<T> {
  storageKey: string;
  columns: DataTableColumn<T>[];
  data: T[];
  rowKey: (row: T) => string | number;
  rowAccentColor?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
  loading?: boolean;
  loadingRowCount?: number;
  emptyMessage?: string;
  sortBy?: string | null;
  sortOrder?: DataTableSortOrder;
  onSortChange?: (sortBy: string, sortOrder: DataTableSortOrder) => void;
}

const DEFAULT_COLUMN_WIDTH_PX = 180;
const MIN_COLUMN_WIDTH_PX = 96;

function parseWidthToPx(width: string | undefined): number | null {
  if (!width) {
    return null;
  }

  const match = width.trim().match(/^(\d+(?:\.\d+)?)px$/i);
  if (!match) {
    return null;
  }

  return Math.max(MIN_COLUMN_WIDTH_PX, Math.round(Number(match[1])));
}

function getDefaultWidth<T>(column: DataTableColumn<T>): number {
  return parseWidthToPx(column.width) ?? DEFAULT_COLUMN_WIDTH_PX;
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
  return <div className="h-3.5 w-3/4 max-w-[12rem] animate-pulse rounded bg-surface-raised" />;
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

type VisibleColumn<T> = {
  definition: DataTableColumn<T>;
  preference: ColumnPreference;
};

const DataTableRows = memo(function DataTableRows<T>({
  data,
  rowKey,
  columns,
  rowAccentColor,
  onRowClick,
}: {
  data: T[];
  rowKey: (row: T) => string | number;
  columns: VisibleColumn<T>[];
  rowAccentColor?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
}) {
  const showAccent = rowAccentColor !== undefined;
  const interactive = onRowClick !== undefined;

  return (
    <>
      {data.map((row) => {
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
            {columns.map(({ definition }) => {
              const cellOverflowVisible = definition.className?.includes('overflow-visible');
              return (
                <td
                  key={definition.key}
                  className={`px-3 py-2 text-text-primary ${definition.className ?? ''} ${
                    cellOverflowVisible ? 'overflow-visible' : 'overflow-hidden'
                  }`}
                >
                  {definition.render ? definition.render(row) : getCellValue(row, definition.key)}
                </td>
              );
            })}
          </tr>
        );
      })}
    </>
  );
}) as <T>(props: {
  data: T[];
  rowKey: (row: T) => string | number;
  columns: VisibleColumn<T>[];
  rowAccentColor?: (row: T) => string | undefined;
  onRowClick?: (row: T) => void;
}) => ReactNode;

export function DataTable<T>({
  storageKey,
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
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const resizeStateRef = useRef<{
    columnId: string;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);

  const defaultPreferences = useMemo(
    () =>
      columns.map((column, index) => ({
        id: column.key,
        visible: true,
        width: getDefaultWidth(column),
        order: index,
      })),
    [columns],
  );

  const {
    columns: columnPreferences,
    setColumnVisible,
    setColumnWidth,
    resetColumns,
    flushPreferences,
  } = useColumnPreferences(storageKey, defaultPreferences);

  const preferencesById = useMemo(
    () => new Map(columnPreferences.map((column) => [column.id, column])),
    [columnPreferences],
  );

  const visibleColumns = useMemo(() => {
    return columns
      .map((definition) => {
        const preference = preferencesById.get(definition.key);
        return preference ? { definition, preference } : null;
      })
      .filter((entry): entry is VisibleColumn<T> => entry !== null && entry.preference.visible)
      .sort((left, right) => left.preference.order - right.preference.order);
  }, [columns, preferencesById]);

  const hideableColumns = useMemo(
    () =>
      columns
        .map((definition) => {
          const preference = preferencesById.get(definition.key);
          if (!preference) {
            return null;
          }

          const canHide = definition.hideable ?? definition.header.trim().length > 0;
          if (!canHide) {
            return null;
          }

          return { definition, preference };
        })
        .filter((entry): entry is VisibleColumn<T> => entry !== null)
        .sort((left, right) => left.preference.order - right.preference.order),
    [columns, preferencesById],
  );

  const totalTableWidth = visibleColumns.reduce(
    (sum, column) => sum + column.preference.width,
    showAccent ? 6 : 0,
  );
  const colSpan = visibleColumns.length + (showAccent ? 1 : 0);
  const visibleCount = hideableColumns.filter((column) => column.preference.visible).length;

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      const activeResize = resizeStateRef.current;
      if (!activeResize) {
        return;
      }

      const nextWidth = Math.max(
        MIN_COLUMN_WIDTH_PX,
        Math.round(activeResize.startWidth + (event.clientX - activeResize.startX)),
      );
      setColumnWidth(activeResize.columnId, nextWidth);
    }

    function handlePointerUp() {
      if (!resizeStateRef.current) {
        return;
      }

      resizeStateRef.current = null;
      document.body.classList.remove('cursor-col-resize', 'select-none');
      flushPreferences();
    }

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [flushPreferences, setColumnWidth]);

  useEffect(() => {
    if (!columnMenuOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (columnMenuRef.current?.contains(target)) {
        return;
      }
      setColumnMenuOpen(false);
    }

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [columnMenuOpen]);

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
    <div className="w-full">
      {hideableColumns.length > 0 && (
        <div className="mb-2 flex justify-end" ref={columnMenuRef}>
          <div className="relative">
            <button
              type="button"
              aria-label="Afișează sau ascunde coloane"
              aria-haspopup="menu"
              aria-expanded={columnMenuOpen}
              onClick={() => setColumnMenuOpen((current) => !current)}
              className="inline-flex size-8 items-center justify-center rounded-md border border-border bg-surface text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              <i className="ti ti-columns-3 text-base" aria-hidden="true" />
            </button>

            {columnMenuOpen && (
              <div
                role="menu"
                aria-label="Coloane tabel"
                className="absolute right-0 top-10 z-20 min-w-52 rounded-lg border border-strong bg-surface-popover p-1.5 shadow-popover"
              >
                {hideableColumns.map(({ definition, preference }) => {
                  const isVisible = preference.visible;
                  const disableHide = isVisible && visibleCount <= 1;

                  return (
                    <label
                      key={definition.key}
                      className={`flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors hover:bg-[var(--color-surface-popover-hover)] ${
                        disableHide ? 'opacity-60' : ''
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isVisible}
                        disabled={disableHide}
                        onChange={(event) => setColumnVisible(definition.key, event.target.checked)}
                        className="size-4 rounded border-border accent-accent"
                      />
                      <span className="text-text-primary">{definition.header}</span>
                    </label>
                  );
                })}

                <button
                  type="button"
                  onClick={() => {
                    resetColumns();
                    setColumnMenuOpen(false);
                  }}
                  className="mt-1 flex w-full items-center justify-start rounded-md px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-[var(--color-surface-popover-hover)] hover:text-text-primary"
                >
                  Resetează coloanele
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="overflow-x-auto border border-border-subtle">
        <table
          className="table-fixed border-collapse text-sm"
          style={{ width: '100%', minWidth: `${totalTableWidth}px` }}
        >
          <colgroup>
            {showAccent && <col style={{ width: '6px' }} />}
            {visibleColumns.map(({ definition, preference }) => (
              <col key={definition.key} style={{ width: `${preference.width}px` }} />
            ))}
          </colgroup>
          <thead>
            <tr className="border-b border-border bg-surface">
              {showAccent && <th className="w-1.5 p-0" aria-hidden="true" />}
              {visibleColumns.map(({ definition, preference }) => {
                const isSortable = Boolean(definition.sortKey && onSortChange);
                const isActive = isSortable && sortBy === definition.sortKey;
                const ariaSort = isActive
                  ? sortOrder === 'asc'
                    ? 'ascending'
                    : 'descending'
                  : isSortable
                    ? 'none'
                    : undefined;

                return (
                  <th
                    key={definition.key}
                    scope="col"
                    aria-sort={ariaSort}
                    className={`relative px-3 py-2 text-left text-[11px] font-medium uppercase tracking-wider text-text-muted ${definition.className ?? ''}`}
                  >
                    {isSortable ? (
                      <button
                        type="button"
                        onClick={() => handleSortClick(definition.sortKey!)}
                        className={`flex w-full min-w-0 items-center gap-1 rounded text-left transition-colors hover:text-text-secondary${
                          isActive ? ' text-accent' : ''
                        }`}
                      >
                        <span className="min-w-0 truncate">{definition.header}</span>
                        <SortIcon active={isActive} order={sortOrder} />
                      </button>
                    ) : (
                      <span className="block truncate pr-2">{definition.header}</span>
                    )}

                    <button
                      type="button"
                      aria-label={`Redimensionează coloana ${definition.header}`}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        resizeStateRef.current = {
                          columnId: definition.key,
                          startX: event.clientX,
                          startWidth: preference.width,
                        };
                        document.body.classList.add('cursor-col-resize', 'select-none');
                      }}
                      className="absolute right-0 top-0 h-full w-3 cursor-col-resize touch-none"
                    >
                      <span
                        aria-hidden="true"
                        className="absolute right-0.5 top-1/2 h-5 w-px -translate-y-1/2 bg-border-strong transition-colors hover:bg-accent"
                      />
                    </button>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              Array.from({ length: loadingRowCount }, (_, index) => (
                <tr key={`skeleton-${index}`} className="border-b border-border-subtle last:border-b-0">
                  {showAccent && <td className="w-1.5 p-0" aria-hidden="true" />}
                  {visibleColumns.map(({ definition }) => (
                    <td key={definition.key} className="px-3 py-2.5">
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
              <DataTableRows
                data={data}
                rowKey={rowKey}
                columns={visibleColumns}
                rowAccentColor={rowAccentColor}
                onRowClick={onRowClick}
              />
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
