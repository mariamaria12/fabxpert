'use client';

import {
  listTimesheets,
  type Period,
  type TimesheetDto,
  type TimesheetListSortBy,
  type SortOrder,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PeriodFilter } from '@/components/PeriodFilter';
import { TimesheetFormPanel } from './TimesheetFormPanel';
import { TimesheetExportPanel } from './TimesheetExportPanel';
import {
  formatRomanianDate,
  formatTimesheetDuration,
  formatProjectLabel,
} from './timesheetFormat';
import { PersonName } from '@/components/PersonAvatar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { replaceById } from '@/utils/replaceById';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: TimesheetListSortBy = 'date';
const DEFAULT_SORT_ORDER: SortOrder = 'desc';

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const searchInputClassName =
  'w-full min-w-[14rem] max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function nullableCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-muted">—</span>;
  }
  return value;
}

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; timesheet: null }
  | { open: true; mode: 'edit'; timesheet: TimesheetDto };

export default function TimesheetsPage() {
  const businessAutofill = useBusinessAutofillProps();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const [timesheets, setTimesheets] = useState<TimesheetDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [exportOpen, setExportOpen] = useState(false);
  const [sortBy, setSortBy] = useState<TimesheetListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, period]);

  const hasActiveFilters = debouncedSearch.length > 0 || period.kind !== 'month';

  const loadTimesheets = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listTimesheets({
        page,
        pageSize: PAGE_SIZE,
        period,
        sortBy,
        sortOrder,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setTimesheets(response.data);
      setTotal(response.meta.total);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, period, sortBy, sortOrder]);

  useEffect(() => {
    void loadTimesheets();
  }, [loadTimesheets]);

  async function refreshAll() {
    setRefreshing(true);
    try {
      await loadTimesheets();
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setSortBy(nextSortBy as TimesheetListSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  function openCreate() {
    setPanel({ open: true, mode: 'create', timesheet: null });
  }

  function openEdit(timesheet: TimesheetDto) {
    setPanel({ open: true, mode: 'edit', timesheet });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved(updated?: TimesheetDto) {
    if (updated) {
      setTimesheets((current) => replaceById(current, updated));
      return;
    }

    void loadTimesheets();
  }

  const tableEmptyMessage = hasActiveFilters
    ? 'Nu există pontaje care să corespundă filtrelor.'
    : 'Nu există pontaje pentru perioada selectată.';

  const timesheetColumns: DataTableColumn<TimesheetDto>[] = [
    {
      key: 'person',
      header: 'Persoană',
      sortKey: 'person',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'project',
      header: 'Proiect',
      sortKey: 'project',
      render: (row) => nullableCell(formatProjectLabel(row)),
    },
    {
      key: 'activity',
      header: 'Activitate',
      sortKey: 'activity',
      render: (row) => nullableCell(row.activity?.name),
    },
    {
      key: 'date',
      header: 'Data',
      sortKey: 'date',
      width: '110px',
      className: 'text-text-secondary',
      render: (row) => formatRomanianDate(row.workDate),
    },
    {
      key: 'duration',
      header: 'Durată',
      width: '90px',
      className: 'text-text-secondary',
      render: (row) => formatTimesheetDuration(row),
    },
  ];

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-text-primary">Pontaje</h1>
        <div className="flex shrink-0 items-center gap-2">
          {lastUpdated ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              actualizat {formatUpdatedAt(lastUpdated)}
            </span>
          ) : null}
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
          >
            <i
              className={`ti ti-refresh text-base ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Împrospătare date
          </button>
          <button
            type="button"
            onClick={() => setExportOpen(true)}
            className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            <i className="ti ti-file-spreadsheet text-base" aria-hidden="true" />
            Export Excel
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Pontaj nou
          </button>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadTimesheets()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      <div className="mt-4 space-y-4">
        <PeriodFilter value={period} onChange={setPeriod} />

        <div className="min-w-[14rem] max-w-md">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Caută după persoană..."
            aria-label="Caută după persoană"
            className={searchInputClassName}
            {...businessAutofill}
          />
        </div>
      </div>

      <div className="mt-6">
        <DataTable
          storageKey="timesheets-list"
          columns={timesheetColumns}
          data={timesheets}
          rowKey={(row) => row.id}
          loading={loading}
          emptyMessage={tableEmptyMessage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          onRowClick={loading ? undefined : openEdit}
        />
        {!loading && total > 0 && (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        )}
      </div>

      {panel.open && (
        <TimesheetFormPanel
          open
          mode={panel.mode}
          timesheet={panel.timesheet}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}

      {exportOpen && (
        <TimesheetExportPanel
          open
          initialPeriod={period}
          onClose={() => setExportOpen(false)}
        />
      )}
    </div>
  );
}
