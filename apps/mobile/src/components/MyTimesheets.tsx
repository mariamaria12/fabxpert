import { ApiError, listMyTimesheets } from '@fabxpert/shared';
import type { TimesheetDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityDot } from './ActivityDot';
import { useToast } from '../context/ToastContext';
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
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFirstPage = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
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

  return (
    <div className="flow-content my-timesheets-content">
      {isLoading ? <p className="flow-status">Se încarcă pontajele…</p> : null}

      {!isLoading && error ? (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button type="button" className="flow-retry-button" onClick={() => void loadFirstPage()}>
            Reîncearcă
          </button>
        </div>
      ) : null}

      {!isLoading && !error && dayGroups.length === 0 ? (
        <p className="flow-status">Nu ai pontaje înregistrate.</p>
      ) : null}

      {!isLoading && !error && dayGroups.length > 0 ? (
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

      {!isLoading && !error && page < totalPages ? (
        <button
          type="button"
          className="timesheet-load-more"
          disabled={isLoadingMore}
          onClick={() => void handleLoadMore()}
        >
          {isLoadingMore ? 'Se încarcă…' : 'Încarcă mai multe'}
        </button>
      ) : null}
    </div>
  );
}
