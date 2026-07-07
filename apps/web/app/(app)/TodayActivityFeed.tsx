'use client';

import { listTimesheets, type TimesheetDto } from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRegisterPanouRefetch } from './PanouRefreshContext';
import { useTimesheetEvents } from '@/context/TimesheetEventsContext';
import { formatActivityTime, todayCreatedAtRange } from '@/utils/timesheetEvents';
import { formatProjectLabel } from '@/app/(app)/timesheets/timesheetFormat';

const REFETCH_DEBOUNCE_MS = 1000;
const TODAY_PAGE_SIZE = 100;

export function TodayActivityFeed() {
  const { subscribe } = useTimesheetEvents();
  const [items, setItems] = useState<TimesheetDto[]>([]);
  const [loading, setLoading] = useState(true);
  const debounceRef = useRef<number | null>(null);

  const loadFeed = useCallback(async () => {
    const range = todayCreatedAtRange();
    const response = await listTimesheets({
      page: 1,
      pageSize: TODAY_PAGE_SIZE,
      createdAtFrom: range.createdAtFrom,
      createdAtTo: range.createdAtTo,
    });
    setItems(response.data);
  }, []);

  const refetchFeed = useCallback(async () => {
    try {
      await loadFeed();
    } catch {
      setItems([]);
    }
  }, [loadFeed]);

  useRegisterPanouRefetch('activity-feed', refetchFeed);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    loadFeed()
      .catch(() => {
        if (!cancelled) {
          setItems([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  useEffect(() => {
    return subscribe(() => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        void loadFeed();
        debounceRef.current = null;
      }, REFETCH_DEBOUNCE_MS);
    });
  }, [subscribe, loadFeed]);

  useEffect(() => {
    return () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-text-secondary">Activitate azi</h2>

      {loading ? (
        <p className="mt-3 text-sm text-text-muted">Se încarcă…</p>
      ) : items.length === 0 ? (
        <p className="mt-3 text-sm text-text-muted">Niciun pontaj adăugat azi.</p>
      ) : (
        <ul className="mt-3 divide-y divide-border-subtle rounded-md border border-border-subtle bg-surface">
          {items.map((timesheet) => (
            <li
              key={timesheet.id}
              className="flex items-start justify-between gap-4 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm text-text-primary">
                  {timesheet.person.firstName} {timesheet.person.lastName}{' '}
                  <span className="text-text-secondary">a adăugat pontaj</span>
                </p>
                <p className="mt-1 inline-flex items-center gap-2 text-xs text-text-muted">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{
                      background: timesheet.project.color ?? 'var(--color-border-subtle)',
                    }}
                    aria-hidden="true"
                  />
                  {formatProjectLabel(timesheet) ?? '—'}
                </p>
              </div>
              <time
                dateTime={timesheet.createdAt}
                className="shrink-0 text-xs tabular-nums text-text-muted"
              >
                {formatActivityTime(timesheet.createdAt)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
