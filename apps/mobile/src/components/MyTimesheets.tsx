import { ApiError, listMyTimesheets } from '@fabxpert/shared';
import type { TimesheetDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityDot } from './ActivityDot';
import { useToast } from '../context/ToastContext';
import { useDelayedLoadingLabel } from '../hooks/useDelayedLoadingLabel';
import { apiErrorToastMessage } from '../utils/apiToastMessage';
import {
  entryDurationMinutes,
  formatDayGroupHeader,
  formatTodayWorkedTotal,
  groupEntriesByLocalDay,
  isEditableTodayEntry,
  sumDayClosedMinutes,
} from '../utils/timeUtils';

interface MyTimesheetsProps {
  onEditEntry: (entry: TimesheetDto) => void;
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function formatEntryDuration(entry: TimesheetDto): string {
  const minutes = entryDurationMinutes(entry);
  if (minutes === null) {
    return '—';
  }

  return formatTodayWorkedTotal(minutes);
}

export function MyTimesheets({ onEditEntry }: MyTimesheetsProps) {
  const { showToast } = useToast();
  const [entries, setEntries] = useState<TimesheetDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isFetching, setIsFetching] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const showLoadingLabel = useDelayedLoadingLabel(isFetching, {
    hasData: entries.length > 0,
  });
  const showLoadMoreLoadingLabel = useDelayedLoadingLabel(isLoadingMore, {
    delayMs: 200,
  });

  const loadFirstPage = useCallback(async () => {
    setIsFetching(true);
    setError(null);

    try {
      const response = await listMyTimesheets(1);
      setEntries(response.data);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setError('Nu s-a putut contacta serverul.');
      } else {
        setError('Nu s-au putut încărca pontajele.');
      }
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    void loadFirstPage();
  }, [loadFirstPage]);

  async function handleLoadMore() {
    if (isLoadingMore || page >= totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await listMyTimesheets(nextPage);
      setEntries((current) => [...current, ...response.data]);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }

  const dayGroups = groupEntriesByLocalDay(entries);
  const showList = !error && dayGroups.length > 0;
  const showError = !isFetching && Boolean(error);
  const showEmpty = !isFetching && !error && dayGroups.length === 0;

  return (
    <div className="flow-content my-timesheets-content">
      {showLoadingLabel ? <p className="flow-status">Se încarcă pontajele…</p> : null}

      {showError ? (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button type="button" className="flow-retry-button" onClick={() => void loadFirstPage()}>
            Reîncearcă
          </button>
        </div>
      ) : null}

      {showEmpty ? <p className="flow-status">Nu ai pontaje înregistrate.</p> : null}

      {showList ? (
        <div className="timesheet-day-groups">
          {dayGroups.map(({ dayKey, entries: dayEntries }) => {
            const { label, isToday } = formatDayGroupHeader(dayKey);
            const dayTotal = formatTodayWorkedTotal(sumDayClosedMinutes(dayEntries));

            return (
              <section key={dayKey} className="timesheet-day-group">
                <div className={`timesheet-day-header${isToday ? ' timesheet-day-header-today' : ''}`}>
                  <h2 className="timesheet-day-title">{label}</h2>
                  <span className="timesheet-day-total">{dayTotal}</span>
                </div>

                <ul className="timesheet-entry-list">
                  {dayEntries.map((entry) => {
                    const editable = isEditableTodayEntry(entry);

                    if (editable) {
                      return (
                        <li key={entry.id}>
                          <button
                            type="button"
                            className="timesheet-entry-row timesheet-entry-row-editable"
                            onClick={() => onEditEntry(entry)}
                          >
                            <span
                              className="option-color-bar option-color-bar-project"
                              style={{
                                background: entry.project.color ?? 'var(--color-border)',
                              }}
                              aria-hidden="true"
                            />
                            <span className="timesheet-entry-body">
                              <span className="timesheet-entry-project">{entry.project.name}</span>
                              {entry.activity ? (
                                <span className="timesheet-entry-activity">
                                  <ActivityDot color={entry.activity.color} />
                                  {entry.activity.name}
                                </span>
                              ) : null}
                            </span>
                            <span className="timesheet-entry-duration">
                              {formatEntryDuration(entry)}
                            </span>
                            <span className="timesheet-entry-chevron">
                              <ChevronRightIcon />
                            </span>
                          </button>
                        </li>
                      );
                    }

                    return (
                      <li key={entry.id}>
                        <div className="timesheet-entry-row">
                          <span
                            className="option-color-bar option-color-bar-project"
                            style={{
                              background: entry.project.color ?? 'var(--color-border)',
                            }}
                            aria-hidden="true"
                          />
                          <span className="timesheet-entry-body">
                            <span className="timesheet-entry-project">{entry.project.name}</span>
                            {entry.activity ? (
                              <span className="timesheet-entry-activity">
                                <ActivityDot color={entry.activity.color} />
                                {entry.activity.name}
                              </span>
                            ) : null}
                          </span>
                          <span className="timesheet-entry-duration">
                            {formatEntryDuration(entry)}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      ) : null}

      {!isFetching && !error && page < totalPages ? (
        <button
          type="button"
          className="timesheet-load-more"
          disabled={isLoadingMore}
          onClick={() => void handleLoadMore()}
        >
          {showLoadMoreLoadingLabel ? 'Se încarcă…' : 'Încarcă mai multe'}
        </button>
      ) : null}
    </div>
  );
}
