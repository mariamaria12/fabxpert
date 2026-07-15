'use client';

import { getPersonSummary, type PersonSummaryPersonRow } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { PersonBreakdownRows } from './PersonBreakdownRows';
import { usePanouDashboard } from './PanouDashboardContext';

function PersonHoursCard({
  person,
  expanded,
  onToggle,
}: {
  person: PersonSummaryPersonRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm shadow-black/10">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-2.5 px-3 py-2.5 text-left transition-colors hover:bg-surface-raised/60"
      >
        <PersonName
          person={person}
          className="min-w-0 flex-1"
          nameClassName="text-sm font-medium text-text-primary"
        />
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-xs font-medium tabular-nums text-text-primary">
              {formatDurationMinutes(person.totalMinutes)}
            </p>
            <p className="text-[10px] text-text-muted">total logat</p>
          </div>
          <i
            className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-base text-text-muted`}
            aria-hidden="true"
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-4 py-3">
          <PersonBreakdownRows activities={person.activities} />
        </div>
      )}
    </div>
  );
}

export function PanouPeopleView() {
  const { period, periodReady } = usePanouDashboard();
  const [persons, setPersons] = useState<PersonSummaryPersonRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getPersonSummary(period);
        setPersons(response.persons);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    if (!periodReady) {
      return;
    }
    void loadSummary();
  }, [loadSummary, period, periodReady]);

  const refetchSummary = useCallback(async () => {
    if (!periodReady) {
      return;
    }
    await loadSummary(true);
  }, [loadSummary, periodReady]);

  useRegisterPanouRefetch('panou-people', refetchSummary);

  function toggleExpanded(personId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(personId)) {
        next.delete(personId);
      } else {
        next.add(personId);
      }
      return next;
    });
  }

  const showEmptyState = !loading && !error && persons.length === 0;
  const waitingForCustomRange = !periodReady;

  return (
    <section className="mt-4">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void refetchSummary()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {waitingForCustomRange && (
        <p className="text-sm text-text-muted">Selectează intervalul de date.</p>
      )}

      {loading && persons.length === 0 && !error && !waitingForCustomRange && (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      )}

      {showEmptyState && (
        <p className="text-sm text-text-muted">Nimeni nu a pontat în perioada selectată.</p>
      )}

      {persons.length > 0 && (
        <div className="space-y-2">
          {persons.map((person) => (
            <PersonHoursCard
              key={person.id}
              person={person}
              expanded={expandedIds.has(person.id)}
              onToggle={() => toggleExpanded(person.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
