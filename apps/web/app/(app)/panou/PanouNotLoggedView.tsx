'use client';

import { getNotLogged, type NotLoggedPersonRow } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard } from './PanouDashboardContext';

function NotLoggedPersonCard({ person }: { person: NotLoggedPersonRow }) {
  return (
    <div className="flex items-center gap-2.5 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 shadow-sm shadow-black/10">
      <PersonName
        person={person}
        className="min-w-0 flex-1"
        nameClassName="text-sm font-medium text-text-primary"
      />
      {person.employeeRoleName && (
        <span className="shrink-0 truncate text-xs text-text-muted">
          {person.employeeRoleName}
        </span>
      )}
    </div>
  );
}

export function PanouNotLoggedView() {
  const { period, periodReady } = usePanouDashboard();
  const [persons, setPersons] = useState<NotLoggedPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadNotLogged = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getNotLogged(period);
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
    void loadNotLogged();
  }, [loadNotLogged, period, periodReady]);

  const refetchNotLogged = useCallback(async () => {
    if (!periodReady) {
      return;
    }
    await loadNotLogged(true);
  }, [loadNotLogged, periodReady]);

  useRegisterPanouRefetch('panou-not-logged', refetchNotLogged);

  const showEmptyState = !loading && !error && persons.length === 0;
  const waitingForCustomRange = !periodReady;

  return (
    <section className="mt-4">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void refetchNotLogged()}
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
        <p className="text-sm text-text-muted">
          Toată lumea a pontat în perioada selectată.
        </p>
      )}

      {persons.length > 0 && (
        <>
          <p className="mb-3 text-xs text-text-muted">
            Persoanele aflate în concediu aprobat nu sunt incluse.
          </p>
          <div className="space-y-2">
            {persons.map((person) => (
              <NotLoggedPersonCard key={person.id} person={person} />
            ))}
          </div>
        </>
      )}
    </section>
  );
}
