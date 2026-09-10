import { listMyTimesheets } from '@fabxpert/shared';
import type { TimesheetDto } from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { ActivityDot } from './ActivityDot';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
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

/** Code, colour dot and denumire lucrare on one line, the client under it. */
function EntryProject({ project }: { project: TimesheetDto['project'] }) {
  return (
    <>
      <span className="timesheet-entry-project">
        <span className="timesheet-entry-code">{project.code}</span>
        <ActivityDot color={project.color} />
        <span className="timesheet-entry-work">
          {project.denumireLucrare ?? project.name}
        </span>
      </span>
      <span className="timesheet-entry-company">{project.company.name}</span>
    </>
  );
}

/** Marks shown on a row before the rest fold behind "Vezi mai multe". */
const VISIBLE_ASSEMBLY_COUNT = 3;

/**
 * The marks this entry closed. Long lists show the first few and a toggle for
 * the rest. On an activity that tracks assemblies, an entry without any is a
 * normal state — someone helping out — so it says so.
 */
function EntryAssemblies({
  entry,
  tracksAssemblies,
}: {
  entry: TimesheetDto;
  tracksAssemblies: boolean;
}) {
  const [showAll, setShowAll] = useState(false);

  if (entry.assemblies.length > 0) {
    const hiddenCount = entry.assemblies.length - VISIBLE_ASSEMBLY_COUNT;
    const visible =
      showAll || hiddenCount <= 0
        ? entry.assemblies
        : entry.assemblies.slice(0, VISIBLE_ASSEMBLY_COUNT);

    return (
      <span className="assembly-chip-row timesheet-entry-assemblies">
        {visible.map((link) => (
          <span key={link.assemblyId} className="assembly-chip assembly-chip-mark">
            {link.name} ×{link.quantityDone}
          </span>
        ))}
        {hiddenCount > 0 ? (
          <button
            type="button"
            className="assembly-chip timesheet-entry-assemblies-toggle"
            aria-expanded={showAll}
            onClick={(event) => {
              event.stopPropagation();
              setShowAll((current) => !current);
            }}
          >
            {showAll ? 'Vezi mai puține' : `Vezi mai multe (+${hiddenCount})`}
          </button>
        ) : null}
      </span>
    );
  }

  if (!tracksAssemblies) {
    return null;
  }

  return <span className="timesheet-entry-no-assemblies">Fără ansamble</span>;
}

/** The observații typed on the entry, kept as written. */
function EntryNotes({ notes }: { notes: string | null }) {
  const text = notes?.trim();
  if (!text) {
    return null;
  }

  return <span className="timesheet-entry-notes">{text}</span>;
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

/**
 * A div rather than a button so the "Vezi mai multe" toggle inside can be a
 * real button. Today's entries open the edit form on tap or Enter/Space.
 */
function EntryRow({
  entry,
  editable,
  onEdit,
  children,
}: {
  entry: TimesheetDto;
  editable: boolean;
  onEdit: (entry: TimesheetDto) => void;
  children: ReactNode;
}) {
  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget) {
      return;
    }

    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onEdit(entry);
    }
  }

  return (
    <div
      className={`timesheet-entry-row${editable ? ' timesheet-entry-row-editable' : ''}`}
      role={editable ? 'button' : undefined}
      tabIndex={editable ? 0 : undefined}
      onClick={editable ? () => onEdit(entry) : undefined}
      onKeyDown={editable ? handleKeyDown : undefined}
    >
      <span
        className="option-color-bar option-color-bar-project"
        style={{ background: entry.project.color ?? 'var(--color-border)' }}
        aria-hidden="true"
      />
      <span className="timesheet-entry-body">{children}</span>
      <span className="timesheet-entry-duration">{formatEntryDuration(entry)}</span>
      {editable ? (
        <span className="timesheet-entry-chevron">
          <ChevronRightIcon />
        </span>
      ) : null}
    </div>
  );
}

export function MyTimesheets({ onEditEntry }: MyTimesheetsProps) {
  const { showToast } = useToast();
  const {
    activities,
    myTimesheetsPage1,
    myTimesheetsPage1Error,
    myTimesheetsPage1Loaded,
    isFetchingMyTimesheetsPage1,
    refreshMyTimesheetsPage1,
  } = useMobileLookupCache();

  /** Empty until the activity cache resolves, which keeps the label from flashing. */
  const assemblyActivityIds = useMemo(
    () =>
      new Set(
        activities.filter((activity) => activity.tracksAssemblies).map((activity) => activity.id),
      ),
    [activities],
  );

  const [extraEntries, setExtraEntries] = useState<TimesheetDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  useEffect(() => {
    if (!myTimesheetsPage1) {
      return;
    }

    setPage(myTimesheetsPage1.meta.page);
    setTotalPages(myTimesheetsPage1.meta.totalPages);
    setExtraEntries([]);
  }, [myTimesheetsPage1]);

  const entries = useMemo(() => {
    if (!myTimesheetsPage1) {
      return [];
    }

    return [...myTimesheetsPage1.data, ...extraEntries];
  }, [myTimesheetsPage1, extraEntries]);

  async function handleLoadMore() {
    if (isLoadingMore || page >= totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await listMyTimesheets(nextPage);
      setExtraEntries((current) => [...current, ...response.data]);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsLoadingMore(false);
    }
  }

  const isFetching = isFetchingMyTimesheetsPage1 && !myTimesheetsPage1Loaded;
  const error = myTimesheetsPage1Error;
  const dayGroups = groupEntriesByLocalDay(entries);
  const showList = !error && dayGroups.length > 0;
  const showError = !isFetching && Boolean(error);
  const showEmpty = !isFetching && !error && dayGroups.length === 0;

  return (
    <div className="flow-content my-timesheets-content">
      {showError ? (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button
            type="button"
            className="flow-retry-button"
            onClick={() => void refreshMyTimesheetsPage1({ force: true })}
          >
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
                    const tracksAssemblies =
                      entry.activityId !== null && assemblyActivityIds.has(entry.activityId);

                    return (
                      <li key={entry.id}>
                        <EntryRow entry={entry} editable={editable} onEdit={onEditEntry}>
                          <EntryProject project={entry.project} />
                          {entry.activity ? (
                            <span className="timesheet-entry-activity">
                              <ActivityDot color={entry.activity.color} />
                              {entry.activity.name}
                            </span>
                          ) : null}
                          <EntryAssemblies entry={entry} tracksAssemblies={tracksAssemblies} />
                          <EntryNotes notes={entry.notes} />
                        </EntryRow>
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
          Încarcă mai multe
        </button>
      ) : null}
    </div>
  );
}
