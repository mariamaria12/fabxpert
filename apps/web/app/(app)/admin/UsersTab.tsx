'use client';

import {
  listUsers,
  type SortOrder,
  type UserDto,
  type UserListSortBy,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { UserFormPanel } from './UserFormPanel';
import { PersonAvatar } from '@/components/PersonAvatar';
import { DataTableSortIcon } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { replaceById } from '@/utils/replaceById';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: UserListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

const searchInputClassName =
  'w-full min-w-[14rem] max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

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

function personName(user: UserDto): string {
  return `${user.person.firstName} ${user.person.lastName}`;
}

export function UsersTab({ active }: UsersTabProps) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<UserListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const usersResponse = await listUsers({
        page,
        pageSize: PAGE_SIZE,
        sortBy,
        sortOrder,
        ...(debouncedSearch ? { search: debouncedSearch } : {}),
      });
      setUsers(usersResponse.data);
      setTotal(usersResponse.meta.total);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, sortBy, sortOrder, debouncedSearch]);

  useEffect(() => {
    if (active) {
      void loadUsers();
    }
  }, [active, loadUsers]);

  function handleNameSort() {
    if (sortBy !== 'name') {
      setSortBy('name');
      setSortOrder('asc');
    } else {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
    }
    setPage(1);
  }

  function openCreate() {
    setPanel({ open: true, mode: 'create', user: null });
  }

  function openEdit(user: UserDto) {
    setPanel({ open: true, mode: 'edit', user });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved(updated?: UserDto) {
    if (updated) {
      setUsers((current) => replaceById(current, updated));
      return;
    }

    void loadUsers();
  }

  if (!active) {
    return null;
  }

  const hasSearch = debouncedSearch.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasSearch;
  const showNoSearchResults = !loading && !error && total === 0 && hasSearch;
  const nameSortActive = sortBy === 'name';

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

      <div className="mt-4 min-w-[14rem] max-w-md">
        <input
          type="search"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          placeholder="Caută după nume sau e-mail..."
          aria-label="Caută utilizatori"
          className={searchInputClassName}
        />
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadUsers()}
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

      {showNoSearchResults && (
        <p className="mt-8 text-center text-sm text-text-muted">
          Niciun utilizator găsit pentru căutarea curentă.
        </p>
      )}

      {(loading || total > 0) && (
        <div className="mt-4 overflow-hidden rounded-md border border-border-subtle bg-surface">
          <div
            className="flex items-center gap-3 border-b border-border-subtle bg-surface px-4 py-2 text-[11px] font-medium uppercase tracking-wider text-text-muted"
            aria-sort={
              nameSortActive ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'
            }
          >
            <button
              type="button"
              onClick={handleNameSort}
              className={`inline-flex min-w-0 flex-1 items-center gap-1 rounded text-left transition-colors hover:text-text-secondary${
                nameSortActive ? ' text-accent' : ''
              }`}
            >
              <span className="truncate">Nume</span>
              <DataTableSortIcon active={nameSortActive} order={sortOrder} />
            </button>
            <span className="hidden min-w-0 flex-[1.2] truncate sm:inline">E-mail</span>
            <span className="hidden w-20 shrink-0 sm:inline">Rol</span>
            <span className="hidden w-16 shrink-0 md:inline">Status</span>
            <span className="w-8 shrink-0" aria-hidden="true" />
          </div>

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
                      <div className="min-w-0 flex-1 sm:hidden">
                        <p className="truncate font-medium text-text-primary">{personName(user)}</p>
                        <p className="truncate text-sm text-text-muted">{user.email}</p>
                      </div>
                      <p className="hidden min-w-0 flex-1 truncate font-medium text-text-primary sm:block">
                        {personName(user)}
                      </p>
                      <p className="hidden min-w-0 flex-[1.2] truncate text-sm text-text-muted sm:block">
                        {user.email}
                      </p>
                      <span
                        className={`hidden w-20 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium sm:inline-block ${rolePillClass(user.role)}`}
                      >
                        {user.role}
                      </span>
                      <span
                        className={`hidden w-16 shrink-0 rounded px-2 py-0.5 text-center text-xs font-medium md:inline-block ${
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
