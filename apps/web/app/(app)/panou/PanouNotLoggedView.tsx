'use client';

import { getNotLogged, type NotLoggedPersonRow } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard } from './PanouDashboardContext';
import { PANOU_PERSON_GROUPS } from './panouPersonGroups';

function useNotLoggedColumns(): DataTableColumn<NotLoggedPersonRow>[] {
  return useMemo(
    (): DataTableColumn<NotLoggedPersonRow>[] => [
      {
        key: 'person',
        header: 'Angajat',
        render: (row) => <PersonName person={row} nameClassName="font-medium" />,
      },
      {
        key: 'employeeRoleName',
        header: 'Rol',
        className: 'text-text-secondary',
        render: (row) => row.employeeRoleName ?? '—',
      },
    ],
    [],
  );
}

export function PanouNotLoggedView() {
  const { period, periodReady } = usePanouDashboard();
  const columns = useNotLoggedColumns();
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

  const waitingForCustomRange = !periodReady;

  return (
    <section className="mt-4 space-y-6">
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

      {!error && !waitingForCustomRange && (
        <>
          <p className="text-xs text-text-muted">
            Conturile de administrator și persoanele aflate în concediu aprobat nu sunt
            incluse.
          </p>

          {PANOU_PERSON_GROUPS.map(({ group, title }) => {
            const rows = persons.filter((person) => person.group === group);

            return (
              <div key={group}>
                <h3 className="mb-2 flex items-baseline gap-2 text-sm font-semibold text-text-primary">
                  {title}
                  {!loading && (
                    <span className="text-xs font-normal tabular-nums text-text-muted">
                      {rows.length}
                    </span>
                  )}
                </h3>
                <DataTable
                  storageKey={`panou-not-logged-${group}`}
                  columns={columns}
                  data={rows}
                  rowKey={(row) => row.id}
                  loading={loading}
                  loadingRowCount={3}
                  emptyMessage="Toată lumea din această categorie a pontat în perioada selectată."
                />
              </div>
            );
          })}
        </>
      )}
    </section>
  );
}
