'use client';

import {
  listTimesheetDayGroups,
  type Period,
  type TimesheetDayGroupDto,
  type TimesheetDto,
  type TimesheetGroupSortBy,
  type SortOrder,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { MobileHeaderAction } from '@/components/MobileHeaderAction';
import { PeriodFilter } from '@/components/PeriodFilter';
import { TimesheetFormPanel } from './TimesheetFormPanel';
import { TimesheetExportPanel } from './TimesheetExportPanel';
import {
  formatDurationMinutes,
  formatRomanianDate,
  formatTimesheetDuration,
} from './timesheetFormat';
import { TimesheetDayGroupPanel } from './TimesheetDayGroupPanel';
import { PanouActivityProgressBar } from '@/app/(app)/panou/PanouActivityProgressBar';
import { PersonName } from '@/components/PersonAvatar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: TimesheetGroupSortBy = 'date';
const DEFAULT_SORT_ORDER: SortOrder = 'desc';
/** A full bar is a 9-hour day, so lengths compare across entries — as on Panou. */
const FULL_BAR_MINUTES = 9 * 60;
const NO_ACTIVITY_LABEL = 'Fără activitate';

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

const searchInputClassName =
  'w-full min-w-[14rem] max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; timesheet: null }
  | { open: true; mode: 'edit'; timesheet: TimesheetDto };

function formatEntryCount(count: number): string {
  return count === 1 ? '1 pontaj' : `${count} pontaje`;
}

/** The day at a glance: what was worked on, in the order it was logged. */
function formatGroupDetails(group: TimesheetDayGroupDto): string {
  return group.entries
    .map((entry) =>
      [entry.project.code, entry.project.denumireLucrare, entry.project.company.name]
        .filter(Boolean)
        .join(' · '),
    )
    .join('  |  ');
}

export default function TimesheetsPage() {
  const businessAutofill = useBusinessAutofillProps();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [period, setPeriod] = useState<Period>({ kind: 'month' });
  const [groups, setGroups] = useState<TimesheetDayGroupDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [exportOpen, setExportOpen] = useState(false);
  const [dayGroup, setDayGroup] = useState<TimesheetDayGroupDto | null>(null);
  const [sortBy, setSortBy] = useState<TimesheetGroupSortBy>(DEFAULT_SORT_BY);
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
      const response = await listTimesheetDayGroups({
        page,
        pageSize: PAGE_SIZE,
        period,
        sortBy,
        sortOrder,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setGroups(response.data);
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
    setSortBy(nextSortBy as TimesheetGroupSortBy);
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

  function openDayGroup(group: TimesheetDayGroupDto) {
    setDayGroup(group);
  }

  // Editing an entry can move it to another day or change the day's totals, so
  // the grouped page is always refetched rather than patched in place.
  function handleSaved() {
    void loadTimesheets();
  }

  const tableEmptyMessage = hasActiveFilters
    ? 'Nu există pontaje care să corespundă filtrelor.'
    : 'Nu există pontaje pentru perioada selectată.';

  const groupColumns: DataTableColumn<TimesheetDayGroupDto>[] = [
    {
      key: 'person',
      header: 'Persoană',
      sortKey: 'person',
      width: '220px',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'date',
      header: 'Dată',
      sortKey: 'date',
      width: '110px',
      className: 'text-text-secondary',
      render: (row) => formatRomanianDate(row.workDate),
    },
    {
      key: 'entries',
      header: 'Total pontaje',
      sortKey: 'entries',
      width: '120px',
      className: 'text-text-secondary',
      render: (row) => formatEntryCount(row.entryCount),
    },
    {
      key: 'duration',
      header: 'Total durată',
      sortKey: 'duration',
      width: '110px',
      className: 'tabular-nums text-text-primary',
      render: (row) => formatDurationMinutes(row.totalMinutes),
    },
    {
      key: 'details',
      header: 'Detalii',
      render: (row) => (
        <span className="block truncate text-text-secondary">{formatGroupDetails(row)}</span>
      ),
    },
    {
      key: 'activityTotals',
      header: 'Total pe activități',
      width: '260px',
      className: 'overflow-hidden',
      render: (row) => (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {row.activityTotals.map((activity) => (
            <span
              key={activity.activityId ?? 'none'}
              className="flex items-center gap-1.5 text-xs text-text-secondary"
            >
              <span
                className="size-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: activity.activityColor ?? 'var(--color-text-muted)' }}
                aria-hidden="true"
              />
              <span className="truncate">{activity.activityName}</span>
              <span className="tabular-nums text-text-primary">
                {formatDurationMinutes(activity.minutes)}
              </span>
            </span>
          ))}
        </div>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '56px',
      className: 'overflow-visible',
      render: (row) => (
        <div className="flex justify-end">
          <button
            type="button"
            aria-label="Editează ziua"
            title="Editează ziua"
            onClick={(event) => {
              event.stopPropagation();
              openDayGroup(row);
            }}
            className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
          >
            <i className="ti ti-pencil text-base" aria-hidden="true" />
          </button>
        </div>
      ),
    },
  ];

  function renderGroupEntries(group: TimesheetDayGroupDto) {
    return (
      <div className="border-t border-border-subtle bg-surface/60 px-4 py-3">
        <div className="space-y-2.5">
          {group.entries.map((entry) => {
            const percent = Math.min(
              Math.round((entry.durationMinutes / FULL_BAR_MINUTES) * 100),
              100,
            );

            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => openEdit(entry)}
                className="block w-full space-y-1.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-surface-raised"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex min-w-0 items-center gap-2">
                      <span
                        className="size-2.5 shrink-0 rounded-full"
                        style={{
                          background: entry.project.color ?? 'var(--color-border-subtle)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm font-medium text-text-primary">
                        <span className="font-mono">{entry.project.code}</span>
                        {entry.project.denumireLucrare && (
                          <>
                            <span className="px-1.5 text-text-muted" aria-hidden="true">
                              ·
                            </span>
                            {entry.project.denumireLucrare}
                          </>
                        )}
                      </span>
                    </div>
                    <div className="truncate pl-[18px] text-xs text-text-muted">
                      {entry.project.company.name}
                    </div>
                    <div className="flex min-w-0 items-center gap-2 pl-[18px]">
                      <span
                        className="size-2 shrink-0 rounded-full"
                        style={{
                          background: entry.activity?.color ?? 'var(--color-border-subtle)',
                        }}
                        aria-hidden="true"
                      />
                      <span className="truncate text-sm text-text-secondary">
                        {entry.activity?.name ?? NO_ACTIVITY_LABEL}
                      </span>
                    </div>
                  </div>
                  <span className="shrink-0 font-mono text-[11px] tabular-nums text-text-muted">
                    {formatTimesheetDuration(entry)}
                  </span>
                </div>

                <PanouActivityProgressBar
                  className="ml-[18px] mr-4"
                  color={entry.activity?.color ?? null}
                  percent={percent}
                />

                {entry.notes && (
                  <div className="ml-[18px] flex gap-1.5 text-[11px] text-text-muted">
                    <i className="ti ti-message-2 mt-0.5 shrink-0 text-xs" aria-hidden="true" />
                    {/* Keeps the line breaks the worker typed on the pontaj. */}
                    <span className="whitespace-pre-wrap [overflow-wrap:anywhere]">
                      {entry.notes}
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="hidden text-[22px] font-medium text-text-primary sm:block">Pontaje</h1>
        <div className="flex shrink-0 items-center gap-2">
          {lastUpdated ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              actualizat {formatUpdatedAt(lastUpdated)}
            </span>
          ) : null}
          <MobileHeaderAction>
            <button
              type="button"
              disabled={refreshing || loading}
              onClick={() => void refreshAll()}
              aria-label="Împrospătare date"
              title="Împrospătare date"
              className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 md:px-3 md:py-2 md:text-sm"
            >
              <i
                className={`ti ti-refresh text-sm md:text-base ${refreshing ? 'animate-spin' : ''}`}
                aria-hidden="true"
              />
              <span className="hidden md:inline">Împrospătare date</span>
            </button>
          </MobileHeaderAction>
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
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast sm:px-4 sm:py-2 sm:text-sm transition-opacity hover:opacity-90"
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

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-[14rem] max-w-md flex-1">
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
      </div>

      <div className="mt-6">
        <DataTable
          storageKey="timesheets-day-groups"
          columns={groupColumns}
          data={groups}
          rowKey={(row) => row.id}
          loading={loading}
          emptyMessage={tableEmptyMessage}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={handleSortChange}
          renderExpandedRow={renderGroupEntries}
        />
        {!loading && total > 0 && (
          <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
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

      {dayGroup && (
        <TimesheetDayGroupPanel
          open
          group={dayGroup}
          onClose={() => setDayGroup(null)}
          onSaved={handleSaved}
        />
      )}

      {exportOpen && (
        <TimesheetExportPanel open initialPeriod={period} onClose={() => setExportOpen(false)} />
      )}
    </div>
  );
}
