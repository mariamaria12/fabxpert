'use client';

import {
  listTimesheets,
  type Period,
  type TimesheetDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PeriodFilter } from '@/components/PeriodFilter';
import { TimesheetFormPanel } from './TimesheetFormPanel';
import { TimesheetExportPanel } from './TimesheetExportPanel';
import {
  CLIENT_SEARCH_FETCH_SIZE,
  paginateSlice,
  timesheetMatchesPersonSearch,
} from './timesheetFilters';
import {
  formatRomanianDate,
  formatTimesheetDuration,
  formatProjectLabel,
} from './timesheetFormat';
import { PersonName } from '@/components/PersonAvatar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

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

  const loadTimesheets = useCallback(
    async (targetPage: number, search: string, activePeriod: Period) => {
      setLoading(true);
      setError(null);

      try {
        if (search) {
          const response = await listTimesheets({
            page: 1,
            pageSize: CLIENT_SEARCH_FETCH_SIZE,
            period: activePeriod,
          });

          const filtered = response.data.filter((timesheet) =>
            timesheetMatchesPersonSearch(timesheet, search),
          );

          setTimesheets(paginateSlice(filtered, targetPage, PAGE_SIZE));
          setTotal(filtered.length);
        } else {
          const response = await listTimesheets({
            page: targetPage,
            pageSize: PAGE_SIZE,
            period: activePeriod,
          });
          setTimesheets(response.data);
          setTotal(response.meta.total);
        }
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadTimesheets(page, debouncedSearch, period);
  }, [page, debouncedSearch, period, loadTimesheets]);

  function openCreate() {
    setPanel({ open: true, mode: 'create', timesheet: null });
  }

  function openEdit(timesheet: TimesheetDto) {
    setPanel({ open: true, mode: 'edit', timesheet });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    void loadTimesheets(page, debouncedSearch, period);
  }

  const tableEmptyMessage = hasActiveFilters
    ? 'Nu există pontaje care să corespundă filtrelor.'
    : 'Nu există pontaje pentru perioada selectată.';

  const timesheetColumns: DataTableColumn<TimesheetDto>[] = [
    {
      key: 'person',
      header: 'Persoană',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'project',
      header: 'Proiect',
      render: (row) => nullableCell(formatProjectLabel(row)),
    },
    {
      key: 'activity',
      header: 'Activitate',
      render: (row) => nullableCell(row.activity?.name),
    },
    {
      key: 'date',
      header: 'Data',
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
            onClick={() => void loadTimesheets(page, debouncedSearch, period)}
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
          />
        </div>
      </div>

      <div className="mt-6">
        <DataTable
          columns={timesheetColumns}
          data={timesheets}
          rowKey={(row) => row.id}
          loading={loading}
          emptyMessage={tableEmptyMessage}
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
