'use client';

import {
  listTimesheetDayGroups,
  type Period,
  type TimesheetDayGroupDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { TimesheetDayGroupPanel } from '@/app/(app)/timesheets/TimesheetDayGroupPanel';
import {
  formatDurationMinutes,
  formatRomanianDate,
} from '@/app/(app)/timesheets/timesheetFormat';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/** A person rarely logs more days than this in one panou period. */
const DAY_PAGE_SIZE = 100;

function formatEntryCount(count: number): string {
  return count === 1 ? '1 pontaj' : `${count} pontaje`;
}

export interface PersonTimesheetDaysPanelProps {
  personId: string;
  personName: string;
  period: Period;
  onClose: () => void;
  /** Called after a pontaj was edited or deleted, so the view behind can refetch. */
  onSaved: () => void;
}

/**
 * Opens the Pontaje day editor for one person: a single logged day goes straight
 * to the editor, several days ask which one first.
 */
export function PersonTimesheetDaysPanel({
  personId,
  personName,
  period,
  onClose,
  onSaved,
}: PersonTimesheetDaysPanelProps) {
  const [groups, setGroups] = useState<TimesheetDayGroupDto[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadGroups = useCallback(
    async (autoSelectSingleDay: boolean) => {
      setLoading(true);
      setError(null);

      try {
        const response = await listTimesheetDayGroups({
          personId,
          period,
          page: 1,
          pageSize: DAY_PAGE_SIZE,
          sortBy: 'date',
          sortOrder: 'desc',
        });
        setGroups(response.data);
        if (autoSelectSingleDay && response.data.length === 1) {
          setSelectedId(response.data[0].id);
        }
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [personId, period],
  );

  useEffect(() => {
    void loadGroups(true);
  }, [loadGroups]);

  const selectedGroup = groups.find((group) => group.id === selectedId) ?? null;
  // With one logged day there is nothing to pick, so closing the editor closes
  // the whole flow instead of dropping onto an empty chooser.
  const singleDay = groups.length === 1;

  function handleGroupClose() {
    if (singleDay) {
      onClose();
      return;
    }
    setSelectedId(null);
  }

  function handleGroupSaved() {
    onSaved();
    void loadGroups(false);
  }

  if (selectedGroup) {
    return (
      <TimesheetDayGroupPanel
        open
        group={selectedGroup}
        onClose={handleGroupClose}
        onSaved={handleGroupSaved}
      />
    );
  }

  return (
    <SlideOverPanel open title="Alege ziua" onClose={onClose}>
      <div className="flex flex-col gap-4">
        <p className="text-sm font-medium text-text-primary">{personName}</p>

        {loading && <p className="text-sm text-text-muted">Se încarcă…</p>}

        {error && (
          <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={() => void loadGroups(true)}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </div>
        )}

        {!loading && !error && groups.length === 0 && (
          <p className="text-sm text-text-muted">
            Nu există pontaje pentru perioada selectată.
          </p>
        )}

        {groups.map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setSelectedId(group.id)}
            className="flex items-center justify-between gap-3 rounded-md border border-border-subtle bg-surface px-3 py-2.5 text-left transition-colors hover:bg-surface-raised"
          >
            <div className="min-w-0">
              <p className="text-sm text-text-primary">{formatRomanianDate(group.workDate)}</p>
              <p className="mt-0.5 text-xs text-text-muted">
                {formatEntryCount(group.entryCount)}
              </p>
            </div>
            <span className="shrink-0 font-mono text-xs tabular-nums text-text-secondary">
              {formatDurationMinutes(group.totalMinutes)}
            </span>
          </button>
        ))}
      </div>
    </SlideOverPanel>
  );
}
