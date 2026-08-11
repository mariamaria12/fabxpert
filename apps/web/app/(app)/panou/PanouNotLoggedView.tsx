'use client';

import { getNotLogged, listUsers, type NotLoggedPersonRow, type UserDto } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { ImpersonationModal } from '../admin/impersonation/ImpersonationModal';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { removeById } from '@/utils/replaceById';
import { TimesheetFormPanel } from '../timesheets/TimesheetFormPanel';
import { useRegisterPanouRefetch, usePanouRefresh } from '../PanouRefreshContext';
import { usePanouDashboard } from './PanouDashboardContext';
import { PANOU_PERSON_GROUPS } from './panouPersonGroups';

/** A full work day — what a missing entry almost always turns out to be. */
const DEFAULT_DURATION = '9h';

/** Employee accounts only — admins are never impersonated. */
const USERS_PAGE_SIZE = 200;

function useNotLoggedColumns(
  onAddTimesheet: (person: NotLoggedPersonRow) => void,
  onImpersonate: (person: NotLoggedPersonRow) => void,
  userByPersonId: Map<string, UserDto>,
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
        width: '180px',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-3">
            {userByPersonId.has(row.id) && (
              <button
                type="button"
                aria-label="Impersonează utilizator"
                title="Impersonează utilizator"
                onClick={() => onImpersonate(row)}
                className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
              >
                <i className="ti ti-eye text-base" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              onClick={() => onAddTimesheet(row)}
              className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
            >
              Adaugă pontaj
            </button>
          </div>
        ),
      },
    ],
    [onAddTimesheet, onImpersonate, userByPersonId],
  );
}

export function PanouNotLoggedView() {
  const { period, periodReady } = usePanouDashboard();
  const { refreshAll } = usePanouRefresh();
  const [persons, setPersons] = useState<NotLoggedPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addForPersonId, setAddForPersonId] = useState<string | null>(null);
  const [userByPersonId, setUserByPersonId] = useState<Map<string, UserDto>>(new Map());
  const [impersonatedUser, setImpersonatedUser] = useState<UserDto | null>(null);

  const openAddTimesheet = useCallback((person: NotLoggedPersonRow) => {
    setAddForPersonId(person.id);
  }, []);

  const openImpersonation = useCallback(
    (person: NotLoggedPersonRow) => {
      const user = userByPersonId.get(person.id);
      if (user) {
        setImpersonatedUser(user);
      }
    },
    [userByPersonId],
  );

  // Rows are persons; impersonation needs their login account. Admins are
  // already excluded server-side, and we skip them here too for good measure.
  useEffect(() => {
    let cancelled = false;

    async function loadUsers() {
      const employees: UserDto[] = [];
      let page = 1;
      let totalPages = 1;

      // pageSize is capped server-side, so walk the pages to cover every account.
      while (page <= totalPages && !cancelled) {
        const response = await listUsers({ page, pageSize: USERS_PAGE_SIZE });
        employees.push(...response.data.filter((user) => user.role === 'EMPLOYEE'));
        totalPages = response.meta.totalPages;
        page += 1;
      }

      if (!cancelled) {
        setUserByPersonId(new Map(employees.map((user) => [user.personId, user])));
      }
    }

    loadUsers().catch(() => {
      // Impersonation is a convenience here — the list itself still works.
    });

    return () => {
      cancelled = true;
    };
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

  const columns = useNotLoggedColumns(openAddTimesheet, openImpersonation, userByPersonId);

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
    <section className="mt-6 space-y-6">
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
            Conturile de administrator, conturile office și persoanele aflate în concediu
            aprobat nu sunt incluse.
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

      {impersonatedUser && (
        <ImpersonationModal
          user={impersonatedUser}
          onClose={() => {
            setImpersonatedUser(null);
            // Time may have been logged for this person while impersonating.
            void refreshAll();
          }}
        />
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
