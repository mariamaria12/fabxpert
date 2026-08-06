'use client';

import { getNotLogged, type NotLoggedPersonRow } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { removeById } from '@/utils/replaceById';
import { TimesheetFormPanel } from '../timesheets/TimesheetFormPanel';
import { useRegisterPanouRefetch, usePanouRefresh } from '../PanouRefreshContext';
import { usePanouDashboard } from './PanouDashboardContext';
import { PANOU_PERSON_GROUPS } from './panouPersonGroups';

/** A full work day — what a missing entry almost always turns out to be. */
const DEFAULT_DURATION = '9h';

function useNotLoggedColumns(
  onAddTimesheet: (person: NotLoggedPersonRow) => void,
): DataTableColumn<NotLoggedPersonRow>[] {
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
      {
        key: 'actions',
        header: '',
        width: '140px',
        className: 'text-right',
        render: (row) => (
          <button
            type="button"
            onClick={() => onAddTimesheet(row)}
            className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Adaugă pontaj
          </button>
        ),
      },
    ],
    [onAddTimesheet],
  );
}

export function PanouNotLoggedView() {
  const { period, periodReady } = usePanouDashboard();
  const { refreshAll } = usePanouRefresh();
  const [persons, setPersons] = useState<NotLoggedPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addForPersonId, setAddForPersonId] = useState<string | null>(null);

  const openAddTimesheet = useCallback((person: NotLoggedPersonRow) => {
    setAddForPersonId(person.id);
  }, []);

  // Drop the row right away — the person has logged time now, so they belong
  // under "au pontat". refreshAll then resyncs the metric cards and the other
  // panou views against the server.
  const handleTimesheetSaved = useCallback(
    (personId: string) => {
      setPersons((current) => removeById(current, personId).items);
      void refreshAll();
    },
    [refreshAll],
  );

  const columns = useNotLoggedColumns(openAddTimesheet);

  const createDefaults = useMemo(
    () => ({ personId: addForPersonId ?? '', duration: DEFAULT_DURATION }),
    [addForPersonId],
  );

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
                <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-text-primary">
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
                  showColumnMenu={false}
                  emptyMessage="Toată lumea din această categorie a pontat în perioada selectată."
                />
              </div>
            );
          })}
        </>
      )}

      {addForPersonId && (
        <TimesheetFormPanel
          open
          mode="create"
          timesheet={null}
          createDefaults={createDefaults}
          onClose={() => setAddForPersonId(null)}
          onSaved={() => handleTimesheetSaved(addForPersonId)}
        />
      )}
    </section>
  );
}
