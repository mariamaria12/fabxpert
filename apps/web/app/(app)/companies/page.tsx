'use client';

import {
  listCompanies,
  type CompanyDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { CompanyFormPanel } from './CompanyFormPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PAGE_SIZE = 20;

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
    key: 'phone',
    header: 'Telefon',
    width: '150px',
    className: 'text-text-secondary',
    render: (row) => nullableCell(row.phone),
  },
  {
    key: 'legalRepresentative',
    header: 'Reprezentant legal',
    render: (row) => nullableCell(row.legalRepresentative),
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
  const [page, setPage] = useState(1);
  const [companies, setCompanies] = useState<CompanyDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });

  const loadCompanies = useCallback(async (targetPage: number) => {
    setLoading(true);
    setError(null);

    try {
      const response = await listCompanies({ page: targetPage, pageSize: PAGE_SIZE });
      setCompanies(response.data);
      setTotal(response.meta.total);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCompanies(page);
  }, [page, loadCompanies]);

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
    void loadCompanies(page);
  }

  const showEmptyState = !loading && !error && total === 0;
  const showTable = loading || total > 0;

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
            onClick={() => void loadCompanies(page)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
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

      {showTable && (
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
