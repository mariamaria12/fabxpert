'use client';

import {
  listPersons,
  type PersonAccountFilter,
  type PersonDto,
  type PersonListSortBy,
  type SortOrder,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { PersonFormPanel } from './PersonFormPanel';
import { CLIENT_SEARCH_FETCH_SIZE, paginateSlice, personMatchesSearch } from './personSearch';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { editActionColumn } from '@/components/editActionColumn';
import { FiltersToggle } from '@/components/FiltersToggle';
import { useIsMobile } from '@/hooks/useIsMobile';
import { Pagination } from '@/components/Pagination';
import { PersonAvatar } from '@/components/PersonAvatar';
import { useSearchAutofillProps } from '@/components/inputAutofill';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: PersonListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

const searchInputClassName =
  'w-full max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function nullableCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-muted">—</span>;
  }
  return value;
}

const personColumns: DataTableColumn<PersonDto>[] = [
  {
    key: 'name',
    header: 'Nume',
    sortKey: 'name',
    render: (row) => (
      <div className="flex min-w-0 items-center gap-3">
        <PersonAvatar person={row} />
        <span className="truncate font-medium">
          {row.firstName} {row.lastName}
        </span>
      </div>
    ),
  },
  {
    key: 'employeeRole',
    header: 'Funcție',
    render: (row) => nullableCell(row.employeeRole?.name),
  },
  {
    key: 'email',
    header: 'E-mail',
    className: 'text-text-secondary',
    render: (row) => nullableCell(row.email),
  },
  {
    key: 'phone',
    header: 'Telefon',
    width: '150px',
    className: 'text-text-secondary',
    render: (row) => nullableCell(row.phone),
  },
];

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; person: null }
  | { open: true; mode: 'edit'; person: PersonDto };

/**
 * One table of the page: the people with an account that can sign in, or the
 * ones without. Each pages and sorts on its own; the search is shared.
 */
function PersonTableSection({
  account,
  title,
  storageKey,
  search,
  refreshToken,
  onEdit,
  onLoaded,
}: {
  account: PersonAccountFilter;
  /** Left out for the main table, which the page heading already names. */
  title?: ReactNode;
  storageKey: string;
  search: string;
  /** Bumped by the page after a save, so both tables read the change. */
  refreshToken: number;
  onEdit: (person: PersonDto) => void;
  /** Reports how many people match, or null while that is not known. */
  onLoaded: (account: PersonAccountFilter, total: number | null) => void;
}) {
  const [page, setPage] = useState(1);
  const [persons, setPersons] = useState<PersonDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<PersonListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);

  useEffect(() => {
    setPage(1);
  }, [search]);

  const loadPersons = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const listParams = {
        page: search ? 1 : page,
        pageSize: search ? CLIENT_SEARCH_FETCH_SIZE : PAGE_SIZE,
        sortBy,
        sortOrder,
        account,
      };

      if (search) {
        // TODO: switch to server-side ?search= when Person list API supports it.
        const response = await listPersons(listParams);
        const filtered = response.data.filter((person) => personMatchesSearch(person, search));
        setPersons(paginateSlice(filtered, page, PAGE_SIZE));
        setTotal(filtered.length);
        onLoaded(account, filtered.length);
      } else {
        const response = await listPersons(listParams);
        setPersons(response.data);
        setTotal(response.meta.total);
        onLoaded(account, response.meta.total);
      }
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
      onLoaded(account, null);
    } finally {
      setLoading(false);
    }
  }, [account, page, search, sortBy, sortOrder, onLoaded]);

  useEffect(() => {
    void loadPersons();
  }, [loadPersons, refreshToken]);

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setSortBy(nextSortBy as PersonListSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  const columns = useMemo(
    () => [...personColumns, editActionColumn<PersonDto>(onEdit, 'Editează persoana')],
    [onEdit],
  );

  if (error) {
    return (
      <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
        <p className="text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => void loadPersons()}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          Reîncearcă
        </button>
      </div>
    );
  }

  // An empty table says nothing the page doesn't already: it shows its own
  // message when nobody matches at all.
  if (!loading && total === 0) {
    return null;
  }

  return (
    <div className="mt-3 sm:mt-6">
      <DataTable
        title={title}
        storageKey={storageKey}
        columns={columns}
        data={persons}
        rowKey={(row) => row.id}
        loading={loading}
        sortBy={sortBy}
        sortOrder={sortOrder}
        onSortChange={handleSortChange}
      />
      {!loading && total > 0 && (
        <Pagination page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
      )}
    </div>
  );
}

export default function PeoplePage() {
  const searchAutofill = useSearchAutofillProps();
  const [searchInput, setSearchInput] = useState('');
  const isMobile = useIsMobile();
  // Phones keep the search bar behind the toggle, like the projects list.
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [debouncedSearch, setDebouncedSearch] = useState('');
  /** How many people each table found; null until it has answered. */
  const [totals, setTotals] = useState<Record<PersonAccountFilter, number | null>>({
    active: null,
    none: null,
  });
  const [refreshToken, setRefreshToken] = useState(0);
  const [panel, setPanel] = useState<PanelState>({ open: false });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const handleLoaded = useCallback((account: PersonAccountFilter, total: number | null) => {
    setTotals((current) =>
      current[account] === total ? current : { ...current, [account]: total },
    );
  }, []);

  function openCreate() {
    setPanel({ open: true, mode: 'create', person: null });
  }

  const openEdit = useCallback((person: PersonDto) => {
    setPanel({ open: true, mode: 'edit', person });
  }, []);

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    setRefreshToken((token) => token + 1);
  }

  const hasActiveSearch = debouncedSearch.length > 0;
  const nobodyFound = totals.active === 0 && totals.none === 0;
  const showEmptyState = nobodyFound && !hasActiveSearch;
  const showNoSearchResults = nobodyFound && hasActiveSearch;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="hidden text-[22px] font-medium text-text-primary sm:block">Persoane</h1>
        {isMobile && !showEmptyState && (
          <FiltersToggle
            open={mobileFiltersOpen}
            onToggle={() => setMobileFiltersOpen((current) => !current)}
          />
        )}
        {!showEmptyState && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast sm:px-4 sm:py-2 sm:text-sm transition-opacity hover:opacity-90"
          >
            Persoană nouă
          </button>
        )}
      </div>

      {!showEmptyState && (!isMobile || mobileFiltersOpen) && (
        <div className="mt-3 sm:mt-4">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Caută după nume, e-mail, telefon sau funcție..."
            aria-label="Caută după nume, e-mail, telefon sau funcție"
            className={searchInputClassName}
            {...searchAutofill}
          />
        </div>
      )}

      {showNoSearchResults && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-text-muted">Nu există persoane care să corespundă căutării.</p>
        </div>
      )}

      {showEmptyState && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-text-muted">Nicio persoană încă.</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast sm:px-4 sm:py-2 sm:text-sm transition-opacity hover:opacity-90"
          >
            Persoană nouă
          </button>
        </div>
      )}

      <PersonTableSection
        account="active"
        storageKey="people-list"
        search={debouncedSearch}
        refreshToken={refreshToken}
        onEdit={openEdit}
        onLoaded={handleLoaded}
      />
      <PersonTableSection
        account="none"
        title={<h2 className="text-sm font-medium text-text-secondary">Persoane fără cont</h2>}
        storageKey="people-list-no-account"
        search={debouncedSearch}
        refreshToken={refreshToken}
        onEdit={openEdit}
        onLoaded={handleLoaded}
      />

      {panel.open && (
        <PersonFormPanel
          open
          mode={panel.mode}
          person={panel.person}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
