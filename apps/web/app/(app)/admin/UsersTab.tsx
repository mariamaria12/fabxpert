'use client';

import {
  listPersons,
  listUsers,
  type PersonDto,
  type UserDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserFormPanel } from './UserFormPanel';
import { PersonAvatar } from '@/components/PersonAvatar';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;

interface UsersTabProps {
  active: boolean;
}

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; user: null }
  | { open: true; mode: 'edit'; user: UserDto };

function rolePillClass(role: UserDto['role']): string {
  return role === 'ADMIN'
    ? 'bg-status-in-proiectare-bg text-status-in-proiectare-text'
    : 'bg-status-ciorna-bg text-status-ciorna-text';
}

export function UsersTab({ active }: UsersTabProps) {
  const [page, setPage] = useState(1);
  const [users, setUsers] = useState<UserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [personsById, setPersonsById] = useState<Map<string, PersonDto>>(new Map());
  const [panel, setPanel] = useState<PanelState>({ open: false });

  const loadUsers = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);

    try {
      const [usersResponse, personsResponse] = await Promise.all([
        listUsers(targetPage, PAGE_SIZE),
        listPersons(1, 500),
      ]);

      setUsers(usersResponse.data);
      setTotal(usersResponse.meta.total);
      setPersonsById(new Map(personsResponse.data.map((person) => [person.id, person])));
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) {
      void loadUsers(page);
    }
  }, [active, page, loadUsers]);

  const subtitleByPersonId = useMemo(() => {
    const map = new Map<string, string>();

    for (const [personId, person] of personsById) {
      const roleName = person.employeeRole?.name ?? '—';
      map.set(personId, `${person.firstName} ${person.lastName} · ${roleName}`);
    }

    return map;
  }, [personsById]);

  function openCreate() {
    setPanel({ open: true, mode: 'create', user: null });
  }

  function openEdit(user: UserDto) {
    setPanel({ open: true, mode: 'edit', user });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    void loadUsers(page);
  }

  if (!active) {
    return null;
  }

  const showEmptyState = !loading && !error && total === 0;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          {loading && users.length === 0 ? 'Se încarcă…' : `${total} utilizatori`}
        </p>
        {!showEmptyState && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Utilizator nou
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadUsers(page)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {showEmptyState && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-text-muted">Niciun utilizator încă.</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Utilizator nou
          </button>
        </div>
      )}

      {(loading || total > 0) && (
        <div className="mt-4 overflow-hidden rounded-md border border-border-subtle bg-surface">
          {loading && users.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-text-muted">Se încarcă…</div>
          ) : (
            <ul className="divide-y divide-border-subtle">
              {users.map((user) => (
                <li key={user.id}>
                  <div className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-surface-raised">
                    <button
                      type="button"
                      onClick={() => openEdit(user)}
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                    >
                      <PersonAvatar person={user.person} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium text-text-primary">{user.email}</p>
                        <p className="truncate text-sm text-text-muted">
                          {subtitleByPersonId.get(user.personId) ??
                            `${user.person.firstName} ${user.person.lastName} · —`}
                        </p>
                      </div>
                      <span
                        className={`hidden shrink-0 rounded px-2 py-0.5 text-xs font-medium sm:inline-block ${rolePillClass(user.role)}`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`hidden shrink-0 rounded px-2 py-0.5 text-xs font-medium md:inline-block ${
                          user.isActive
                            ? 'bg-status-livrat-bg text-status-livrat-text'
                            : 'bg-status-anulat-bg text-status-anulat-text'
                        }`}
                      >
                        {user.isActive ? 'Activ' : 'Inactiv'}
                      </span>
                    </button>
                    <button
                      type="button"
                      aria-label="Editează utilizatorul"
                      onClick={() => openEdit(user)}
                      className="shrink-0 rounded p-1.5 text-text-muted opacity-0 transition-all hover:bg-surface hover:text-text-primary group-hover:opacity-100 focus:opacity-100"
                    >
                      <i className="ti ti-pencil text-base" aria-hidden="true" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}

          {!loading && total > 0 && (
            <div className="border-t border-border-subtle px-2">
              <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
            </div>
          )}
        </div>
      )}

      {panel.open && (
        <UserFormPanel
          open
          mode={panel.mode}
          user={panel.user}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
