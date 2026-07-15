'use client';

import {
  formatProjectDueDate,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
  listProjects,
  type ProjectDto,
  type ProjectListSortBy,
  type SortOrder,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProjectFormPanel } from './ProjectFormPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { replaceById } from '@/utils/replaceById';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: ProjectListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

const searchInputClassName =
  'w-full max-w-md rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

function nullableCell(value: string | null | undefined) {
  if (!value) {
    return <span className="text-text-muted">—</span>;
  }
  return value;
}

function ProjectStatusBadge({ status }: { status: ProjectDto['status'] }) {
  return (
    <span
      className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${getProjectStatusBadgeClassName(status)}`}
    >
      {getProjectStatusLabel(status)}
    </span>
  );
}

function DueDateCell({ project }: { project: ProjectDto }) {
  if (!project.dueDate) {
    return <span className="text-text-muted">—</span>;
  }

  const overdue = isProjectDueDateOverdue(project.dueDate, project.status);
  return (
    <span className={overdue ? 'text-danger' : 'text-text-secondary'}>
      {formatProjectDueDate(project.dueDate)}
    </span>
  );
}

type PanelState =
  | { open: false }
  | { open: true; mode: 'create'; project: null }
  | { open: true; mode: 'edit'; project: ProjectDto };

export default function ProjectsPage() {
  const businessAutofill = useBusinessAutofillProps();
  const [page, setPage] = useState(1);
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [sortBy, setSortBy] = useState<ProjectListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch]);

  const projectColumns = useMemo((): DataTableColumn<ProjectDto>[] => {
    return [
      {
        key: 'code',
        header: 'Cod',
        sortKey: 'code',
        width: '120px',
        className: 'font-mono text-xs text-text-secondary',
        render: (row) => row.code,
      },
      {
        key: 'name',
        header: 'Proiect',
        sortKey: 'name',
        render: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: 'company',
        header: 'Client',
        sortKey: 'company',
        className: 'text-text-secondary',
        render: (row) => row.company.name,
      },
      {
        key: 'status',
        header: 'Status',
        width: '150px',
        render: (row) => <ProjectStatusBadge status={row.status} />,
      },
      {
        key: 'startDate',
        header: 'Început',
        sortKey: 'startDate',
        width: '90px',
        render: (row) =>
          row.startDate ? (
            <span className="text-text-secondary">{formatProjectDueDate(row.startDate)}</span>
          ) : (
            nullableCell(null)
          ),
      },
      {
        key: 'dueDate',
        header: 'Termen',
        sortKey: 'dueDate',
        width: '90px',
        render: (row) => <DueDateCell project={row} />,
      },
      {
        key: 'readyForExecution',
        header: 'Gata exec.',
        width: '90px',
        className: 'text-center',
        render: (row) =>
          row.readyForExecution ? (
            <span className="inline-flex justify-center text-success" aria-label="Gata de execuție">
              <i className="ti ti-check text-base" aria-hidden="true" />
            </span>
          ) : (
            nullableCell(null)
          ),
      },
      {
        key: 'visibleForRoles',
        header: 'Vizibil pentru',
        width: '160px',
        className: 'text-text-secondary',
        render: (row) => {
          const roles = row.visibleForRoles ?? [];
          if (roles.length === 0) {
            return <span className="text-text-muted">Toți</span>;
          }
          return (
            <span className="truncate" title={roles.map((role) => role.name).join(', ')}>
              {roles.map((role) => role.name).join(', ')}
            </span>
          );
        },
      },
    ];
  }, []);

  const loadProjects = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects({
        page,
        pageSize: PAGE_SIZE,
        search: debouncedSearch || undefined,
        sortBy,
        sortOrder,
      });
      setProjects(response.data);
      setTotal(response.meta.total);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, sortBy, sortOrder]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setSortBy(nextSortBy as ProjectListSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  function openCreate() {
    setPanel({ open: true, mode: 'create', project: null });
  }

  function openEdit(project: ProjectDto) {
    setPanel({ open: true, mode: 'edit', project });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved(updated?: ProjectDto) {
    if (updated) {
      setProjects((current) => replaceById(current, updated));
      return;
    }

    void loadProjects();
  }

  const hasActiveSearch = debouncedSearch.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasActiveSearch;
  const showNoSearchResults = !loading && !error && total === 0 && hasActiveSearch;
  const showDataTable = loading || total > 0;

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-text-primary">Proiecte</h1>
        {!showEmptyState && (
          <button
            type="button"
            onClick={openCreate}
            className="shrink-0 rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Proiect nou
          </button>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadProjects()}
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
            placeholder="Caută după denumire, cod sau client..."
            aria-label="Caută după denumire, cod sau client"
            className={searchInputClassName}
            {...businessAutofill}
          />
        </div>
      )}

      {showNoSearchResults && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-text-muted">Nu există proiecte care să corespundă căutării.</p>
        </div>
      )}

      {showEmptyState && (
        <div className="flex flex-1 flex-col items-center justify-center gap-4">
          <p className="text-sm text-text-muted">Niciun proiect încă.</p>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-md bg-accent px-4 py-2 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90"
          >
            Proiect nou
          </button>
        </div>
      )}

      {showDataTable && (
        <div className="mt-6">
          <DataTable
            columns={projectColumns}
            data={projects}
            rowKey={(row) => row.id}
            rowAccentColor={(row) => row.color ?? 'var(--color-border-subtle)'}
            loading={loading}
            onRowClick={loading ? undefined : openEdit}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
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
        <ProjectFormPanel
          open
          mode={panel.mode}
          project={panel.project}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      )}
    </div>
  );
}
