'use client';

import {
  listCompanies,
  type CompanyDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { CompanyFormPanel } from './CompanyFormPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
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

const companyColumns: DataTableColumn<CompanyDto>[] = [
  {
    key: 'name',
    header: 'Denumire',
    render: (row) => (
      <span className="inline-flex items-center gap-2">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ background: row.color ?? 'var(--color-border-subtle)' }}
          aria-hidden="true"
        />
        <span className="font-medium">{row.name}</span>
      </span>
    ),
  },
  {
    key: 'taxCode',
    header: 'Cod fiscal',
    width: '130px',
    className: 'font-mono text-xs text-text-secondary',
    render: (row) => nullableCell(row.taxCode),
  },
  {
    key: 'contactPersonPhone',
    header: 'Telefon POC',
    width: '150px',
    className: 'text-text-secondary',
    render: (row) => nullableCell(row.contactPersonPhone),
  },
  {
    key: 'contactPerson',
    header: 'Persoana de contact',
    render: (row) => nullableCell(row.contactPerson),
  },
  {
    key: 'email',
    header: 'E-mail',
    className: 'text-text-secondary',
    render: (row) => nullableCell(row.email),
  },
];

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; company: null }
  | { open: true; mode: 'edit'; company: CompanyDto };

export default function CompaniesPage() {
  const businessAutofill = useBusinessAutofillProps();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
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

  const loadCompanies = useCallback(async (targetPage: number, search?: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await listCompanies({
        page: targetPage,
        pageSize: PAGE_SIZE,
        search,
      });
      setCompanies(response.data);
      setTotal(response.meta.total);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies(page, debouncedSearch || undefined);
  }, [page, debouncedSearch, loadCompanies]);

  function openCreate() {
    setPanel({ open: true, mode: 'create', company: null });
  }

  function openEdit(company: CompanyDto) {
    setPanel({ open: true, mode: 'edit', company });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    void loadCompanies(page, debouncedSearch || undefined);
  }

  const hasActiveSearch = debouncedSearch.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasActiveSearch;
  const showNoSearchResults = !loading && !error && total === 0 && hasActiveSearch;
  const showDataTable = loading || total > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-text-primary">Companii</h1>
        {!showEmptyState && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Companie nouă
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadCompanies(page, debouncedSearch || undefined)}
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
            placeholder="Caută după denumire sau POC..."
            aria-label="Caută după denumire sau POC"
            className={searchInputClassName}
            {...businessAutofill}
          />
        </div>
      )}

      {showNoSearchResults && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-text-muted">Nu există companii care să corespundă căutării.</p>
        </div>
      )}

      {showEmptyState && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-text-muted">Nicio companie încă.</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Companie nouă
          </button>
        </div>
      )}

      {showDataTable && (
        <div className="mt-6">
          <DataTable
            columns={companyColumns}
            data={companies}
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
        <CompanyFormPanel
          open
          mode={panel.mode}
          company={panel.company}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
