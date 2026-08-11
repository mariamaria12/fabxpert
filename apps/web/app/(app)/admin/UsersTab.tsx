'use client';

import { listUsers, type SortOrder, type UserDto } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { UserFormPanel } from './UserFormPanel';
import { ImpersonationModal } from './impersonation/ImpersonationModal';
import { PersonAvatar } from '@/components/PersonAvatar';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { loadAllPages } from '@/utils/loadAllPages';
import { replaceById } from '@/utils/replaceById';

const PAGE_SIZE = 20;
const LOAD_PAGE_SIZE = 200;
const SEARCH_DEBOUNCE_MS = 300;
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

/** Account groups shown as separate tables — every user lands in exactly one. */
type UserGroupId = 'angajati' | 'office' | 'externi';

const USER_GROUPS: {
  id: UserGroupId;
  title: string;
  description: string;
  emptyMessage: string;
}[] = [
  {
    id: 'angajati',
    title: 'Angajați',
    description: 'conturi cu rol employee',
    emptyMessage: 'Niciun angajat.',
  },
  {
    id: 'externi',
    title: 'Externi',
    description: 'văd doar proiectele alocate specific',
    emptyMessage: 'Niciun utilizator extern.',
  },
  {
    id: 'office',
    title: 'Office',
    description: 'conturi admin și office',
    emptyMessage: 'Niciun utilizator office.',
  },
];

function userGroupOf(user: UserDto): UserGroupId {
  if (user.role === 'ADMIN' || user.isOfficeUser) {
    return 'office';
  }
  return user.restrictedProjects ? 'externi' : 'angajati';
}

function personName(user: UserDto): string {
  return `${user.person.firstName} ${user.person.lastName}`;
}

function compareByName(a: UserDto, b: UserDto): number {
  return (
    a.person.lastName.localeCompare(b.person.lastName, 'ro') ||
    a.person.firstName.localeCompare(b.person.firstName, 'ro') ||
    a.id.localeCompare(b.id)
  );
}

interface UserGroupTableProps {
  title: string;
  description: string;
  emptyMessage: string;
  storageKey: string;
  users: UserDto[];
  columns: DataTableColumn<UserDto>[];
  loading: boolean;
  onRowClick: (user: UserDto) => void;
}

/** One group table with its own sort order and pagination over the loaded rows. */
function UserGroupTable({
  title,
  description,
  emptyMessage,
  storageKey,
  users,
  columns,
  loading,
  onRowClick,
}: UserGroupTableProps) {
  const [page, setPage] = useState(1);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);

  const sortedUsers = useMemo(() => {
    const rows = [...users].sort(compareByName);
    return sortOrder === 'desc' ? rows.reverse() : rows;
  }, [users, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(sortedUsers.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);

  useEffect(() => {
    setPage((current) => Math.min(current, totalPages));
  }, [totalPages]);

  const pageUsers = sortedUsers.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  return (
    <section className="relative mt-8 first:mt-0">
      {/* Sits on the table's own column-menu row (that button is right-aligned),
          so the label stays tight against the table header. */}
      <div className="absolute left-0 top-0 flex h-8 items-center gap-2">
        <h2 className="text-sm font-medium text-text-primary">{title}</h2>
        <span className="text-xs text-text-muted">
          {loading ? 'se încarcă…' : `${sortedUsers.length} · ${description}`}
        </span>
      </div>

      <div>
        <DataTable
          storageKey={storageKey}
          columns={columns}
          data={pageUsers}
          rowKey={(user) => user.id}
          loading={loading}
          loadingRowCount={3}
          emptyMessage={emptyMessage}
          sortBy="name"
          sortOrder={sortOrder}
          onSortChange={(_sortBy, nextSortOrder) => {
            setSortOrder(nextSortOrder);
            setPage(1);
          }}
          onRowClick={loading ? undefined : onRowClick}
        />
        {!loading && sortedUsers.length > PAGE_SIZE && (
          <div className="border-x border-b border-border-subtle px-2">
            <Pagination
              page={safePage}
              pageSize={PAGE_SIZE}
              total={sortedUsers.length}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>
    </section>
  );
}

export function UsersTab({ active }: UsersTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [users, setUsers] = useState<UserDto[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [impersonatedUser, setImpersonatedUser] = useState<UserDto | null>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timeout);
  }, [searchInput]);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Every row is fetched once, then split into groups on render — each group
      // table paginates on its own.
      const allUsers = await loadAllPages(
        (page, pageSize) =>
          listUsers({
            page,
            pageSize,
            sortBy: 'name',
            sortOrder: 'asc',
            ...(debouncedSearch ? { search: debouncedSearch } : {}),
          }),
        LOAD_PAGE_SIZE,
      );
      setUsers(allUsers);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (active) {
      void loadUsers();
    }
  }, [active, loadUsers]);

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
    // Changing the role, the office flag or "proiecte alocate specific" moves the
    // row to another table — grouping is derived on render, so replacing is enough.
    if (updated) {
      setUsers((current) => replaceById(current, updated));
      return;
    }

    void loadUsers();
  }

  const userColumns = useMemo((): DataTableColumn<UserDto>[] => {
    return [
      {
        key: 'name',
        header: 'Nume',
        sortKey: 'name',
        width: '240px',
        render: (user) => (
          <div className="flex min-w-0 items-center gap-3">
            <PersonAvatar person={user.person} />
            <span className="truncate font-medium text-text-primary">{personName(user)}</span>
          </div>
        ),
      },
      {
        key: 'employeeRole',
        header: 'Funcție',
        width: '180px',
        className: 'text-text-secondary',
        render: (user) => user.person.employeeRole?.name ?? '—',
      },
      {
        key: 'email',
        header: 'E-mail',
        width: '260px',
        className: 'text-text-muted',
      },
      {
        key: 'isActive',
        header: 'Status',
        width: '120px',
        render: (user) => (
          <span
            className={`inline-block rounded px-2 py-0.5 text-center text-xs font-medium ${
              user.isActive
                ? 'bg-status-livrat-bg text-status-livrat-text'
                : 'bg-status-anulat-bg text-status-anulat-text'
            }`}
          >
            {user.isActive ? 'Activ' : 'Inactiv'}
          </span>
        ),
      },
      {
        key: 'actions',
        header: '',
        width: '96px',
        className: 'overflow-visible',
        render: (user) => (
          <div className="flex justify-end gap-1">
            {user.role === 'EMPLOYEE' && (
              <button
                type="button"
                aria-label="Impersonează utilizator"
                title="Impersonează utilizator"
                onClick={(event) => {
                  event.stopPropagation();
                  setImpersonatedUser(user);
                }}
                className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
              >
                <i className="ti ti-eye text-base" aria-hidden="true" />
              </button>
            )}
            <button
              type="button"
              aria-label="Editează utilizatorul"
              onClick={(event) => {
                event.stopPropagation();
                openEdit(user);
              }}
              className="rounded p-1.5 text-text-muted transition-all hover:bg-surface hover:text-text-primary"
            >
              <i className="ti ti-pencil text-base" aria-hidden="true" />
            </button>
          </div>
        ),
      },
    ];
  }, []);

  const groupedUsers = useMemo(() => {
    const groups: Record<UserGroupId, UserDto[]> = { angajati: [], office: [], externi: [] };
    for (const user of users) {
      groups[userGroupOf(user)].push(user);
    }
    return groups;
  }, [users]);

  if (!active) {
    return null;
  }

  const total = users.length;
  const hasSearch = debouncedSearch.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasSearch;
  const showNoSearchResults = !loading && !error && total === 0 && hasSearch;

  return (
    <div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-text-secondary">
          {loading && total === 0 ? 'Se încarcă…' : `${total} utilizatori`}
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
        <div className="mt-6">
          {USER_GROUPS.map((group) => (
            <UserGroupTable
              key={group.id}
              title={group.title}
              description={group.description}
              emptyMessage={group.emptyMessage}
              storageKey={`admin-users-list-${group.id}`}
              users={groupedUsers[group.id]}
              columns={userColumns}
              loading={loading}
              onRowClick={openEdit}
            />
          ))}
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

      {impersonatedUser && (
        <ImpersonationModal
          user={impersonatedUser}
          onClose={() => setImpersonatedUser(null)}
        />
      )}
    </div>
  );
}
