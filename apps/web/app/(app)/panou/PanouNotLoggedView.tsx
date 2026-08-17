'use client';

import { getNotLogged, listUsers, type NotLoggedPersonRow, type UserDto } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { ImpersonationModal } from '../admin/impersonation/ImpersonationModal';
import { SendReminderConfirm } from './SendReminderConfirm';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useIsMobile } from '@/hooks/useIsMobile';
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
  onSendReminder: (person: NotLoggedPersonRow) => void,
  isMobile: boolean,
): DataTableColumn<NotLoggedPersonRow>[] {
  return useMemo(
    (): DataTableColumn<NotLoggedPersonRow>[] => [
      {
        key: 'person',
        header: 'Angajat',
        render: (row) => <PersonName person={row} nameClassName="font-medium" />,
      },
      // The table is fixed-width per column, so a phone has to drop "Rol"
      // outright — hiding the cells in CSS would leave the gap behind.
      ...(isMobile
        ? []
        : [
            {
              key: 'employeeRoleName',
              header: 'Rol',
              className: 'text-text-secondary',
              render: (row: NotLoggedPersonRow) => row.employeeRoleName ?? '—',
            },
          ]),
      {
        key: 'actions',
        header: '',
        width: isMobile ? '96px' : '220px',
        className: 'text-right',
        render: (row) => (
          <div className="flex items-center justify-end gap-3">
            {/* Both need a login account: one to impersonate, one to notify. */}
            {userByPersonId.has(row.id) && (
              <>
                <button
                  type="button"
                  aria-label="Trimite notificare"
                  title="Trimite notificare de pontaj"
                  onClick={() => onSendReminder(row)}
                  className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
                >
                  <i className="ti ti-bell text-base" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Impersonează utilizator"
                  title="Impersonează utilizator"
                  onClick={() => onImpersonate(row)}
                  className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
                >
                  <i className="ti ti-eye text-base" aria-hidden="true" />
                </button>
              </>
            )}
            {!isMobile && (
              <button
                type="button"
                onClick={() => onAddTimesheet(row)}
                className="rounded-md bg-accent px-2.5 py-1 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90"
              >
                Adaugă pontaj
              </button>
            )}
          </div>
        ),
      },
    ],
    [onAddTimesheet, onImpersonate, userByPersonId, onSendReminder, isMobile],
  );
}

export function PanouNotLoggedView() {
  const {
    period,
    periodReady,
    includeExternalCollaborators,
    setIncludeExternalCollaborators,
  } = usePanouDashboard();
  const { refreshAll } = usePanouRefresh();
  const [persons, setPersons] = useState<NotLoggedPersonRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addForPersonId, setAddForPersonId] = useState<string | null>(null);
  const [userByPersonId, setUserByPersonId] = useState<Map<string, UserDto>>(new Map());
  const [impersonatedUser, setImpersonatedUser] = useState<UserDto | null>(null);
  const [reminderTarget, setReminderTarget] = useState<NotLoggedPersonRow | null>(null);
  const isMobile = useIsMobile();

  const openSendReminder = useCallback((person: NotLoggedPersonRow) => {
    setReminderTarget(person);
  }, []);

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

  const columns = useNotLoggedColumns(
    openAddTimesheet,
    openImpersonation,
    userByPersonId,
    openSendReminder,
    isMobile,
  );

  const createDefaults = useMemo(
    () => ({ personId: addForPersonId ?? '', duration: DEFAULT_DURATION }),
    [addForPersonId],
  );

  const loadNotLogged = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
        // A foreground reload swaps the whole row set — don't leave a confirm
        // pinned to someone who may no longer be listed.
        setReminderTarget(null);
      }
      setError(null);

      try {
        const response = await getNotLogged(period, includeExternalCollaborators);
        setPersons(response.persons);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [period, includeExternalCollaborators],
  );

  useEffect(() => {
    if (!periodReady) {
      return;
    }
    void loadNotLogged();
  }, [loadNotLogged, period, periodReady, includeExternalCollaborators]);

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

          {PANOU_PERSON_GROUPS.filter(
            ({ group }) => group !== 'external' || includeExternalCollaborators,
          ).map(({ group, title }) => {
            const rows = persons.filter((person) => person.group === group);

            return (
              <div key={group}>
                <DataTable
                  title={
                    <h3 className="flex items-baseline gap-2 text-sm font-semibold text-text-primary">
                      {title}
                      {!loading && (
                        <span className="text-xs font-normal tabular-nums text-text-muted">
                          {rows.length}
                        </span>
                      )}
                    </h3>
                  }
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

          <div className="flex justify-end">
            <button
              type="button"
              onClick={() =>
                setIncludeExternalCollaborators(!includeExternalCollaborators)
              }
              aria-expanded={includeExternalCollaborators}
              className="inline-flex items-center gap-1 rounded-md py-1 text-sm font-medium text-accent transition-opacity hover:opacity-80"
            >
              {includeExternalCollaborators
                ? 'Ascunde colaboratorii externi'
                : 'Afișează colaboratori externi'}
              <i
                className={`ti ${
                  includeExternalCollaborators ? 'ti-chevron-up' : 'ti-chevron-down'
                } text-base`}
                aria-hidden="true"
              />
            </button>
          </div>
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

      {reminderTarget && (
        <SendReminderConfirm
          person={reminderTarget}
          onDone={() => setReminderTarget(null)}
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
