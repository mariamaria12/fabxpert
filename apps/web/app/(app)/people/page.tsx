'use client';

import {
  listPersons,
  type PersonDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PersonFormPanel } from './PersonFormPanel';
import {
  CLIENT_SEARCH_FETCH_SIZE,
  paginateSlice,
  personMatchesSearch,
} from './personSearch';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

const searchInputClassName =
  'w-full max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function nullableCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-muted">—</span>;
  }
  return value;
}

function personFullName(person: PersonDto) {
  return `${person.firstName} ${person.lastName}`;
}

const personColumns: DataTableColumn<PersonDto>[] = [
  {
    key: 'name',
    header: 'Nume',
    className: 'font-medium',
    render: (row) => personFullName(row),
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

export default function PeoplePage() {
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [persons, setPersons] = useState<PersonDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const loadPersons = useCallback(async (targetPage: number, search?: string) => {
    setLoading(true);
    setError(null);

    try {
      if (search) {
        // TODO: switch to server-side ?search= when Person list API supports it.
        const response = await listPersons(1, CLIENT_SEARCH_FETCH_SIZE);
        const filtered = response.data.filter((person) => personMatchesSearch(person, search));
        setPersons(paginateSlice(filtered, targetPage, PAGE_SIZE));
        setTotal(filtered.length);
      } else {
        const response = await listPersons(targetPage, PAGE_SIZE);
        setPersons(response.data);
        setTotal(response.meta.total);
      }
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPersons(page, debouncedSearch || undefined);
  }, [page, debouncedSearch, loadPersons]);

  function openCreate() {
    setPanel({ open: true, mode: 'create', person: null });
  }

  function openEdit(person: PersonDto) {
    setPanel({ open: true, mode: 'edit', person });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    void loadPersons(page, debouncedSearch || undefined);
  }

  const hasActiveSearch = debouncedSearch.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasActiveSearch;
  const showNoSearchResults = !loading && !error && total === 0 && hasActiveSearch;
  const showDataTable = loading || total > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-text-primary">Persoane</h1>
        {!showEmptyState && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Persoană nouă
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadPersons(page, debouncedSearch || undefined)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {!showEmptyState && (
        <div className="mt-4">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Caută după nume, e-mail, telefon sau funcție..."
            aria-label="Caută după nume, e-mail, telefon sau funcție"
            className={searchInputClassName}
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
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Persoană nouă
          </button>
        </div>
      )}

      {showDataTable && (
        <div className="mt-6">
          <DataTable
            columns={personColumns}
            data={persons}
            rowKey={(row) => row.id}
            loading={loading}
            onRowClick={loading ? undefined : openEdit}
          />
          {!loading && total > 0 && (
            <Pagination
              page={page}
              pageSize={PAGE_SIZE}
              total={total}
              onPageChange={setPage}
            />
          )}
        </div>
      )}

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
