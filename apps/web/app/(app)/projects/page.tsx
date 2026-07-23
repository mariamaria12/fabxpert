'use client';

import {
  formatProjectDueDate,
  getProject,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
  listProjects,
  type ProjectDto,
  type ProjectListSortBy,
  type ProjectStatus,
  type SortOrder,
} from '@fabxpert/shared';
import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ProjectFormPanel } from './ProjectFormPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import {
  ProjectNameCell,
  projectClientTableColumnLayout,
  projectCodeTableColumnLayout,
  projectNameTableColumnLayout,
  TruncatedTableCell,
} from '@/components/ProjectNameCell';
import { Pagination } from '@/components/Pagination';
import { SearchableMultiSelect } from '@/components/SearchableMultiSelect';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { panouPathFromProjectEditReturn } from '@/utils/projectEditNavigation';
import { STATUS_FILTER_OPTIONS } from '@/utils/projectStatusFilter';
import { replaceById } from '@/utils/replaceById';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;
const DEFAULT_SORT_BY: ProjectListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

const searchInputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

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
  const router = useRouter();
  const searchParams = useSearchParams();
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
  const [statusFilters, setStatusFilters] = useState<ProjectStatus[]>([]);
  const deepLinkEditId = searchParams.get('edit');
  const returnTarget = searchParams.get('return');

  useEffect(() => {
    if (!deepLinkEditId) {
      return;
    }

    let cancelled = false;

    getProject(deepLinkEditId)
      .then((project) => {
        if (!cancelled) {
          setPanel({ open: true, mode: 'edit', project });
        }
      })
      .catch((caught) => {
        if (!cancelled) {
          setError(apiErrorToastMessage(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [deepLinkEditId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilters]);

  const projectColumns = useMemo((): DataTableColumn<ProjectDto>[] => {
    return [
      {
        key: 'code',
        header: 'Cod',
        sortKey: 'code',
        width: projectCodeTableColumnLayout.width,
        className: projectCodeTableColumnLayout.className,
        render: (row) => <TruncatedTableCell text={row.code} />,
      },
      {
        key: 'name',
        header: 'Proiect',
        sortKey: 'name',
        width: projectNameTableColumnLayout.width,
        className: projectNameTableColumnLayout.className,
        render: (row) => <ProjectNameCell name={row.name} />,
      },
      {
        key: 'company',
        header: 'Client',
        sortKey: 'company',
        width: projectClientTableColumnLayout.width,
        className: projectClientTableColumnLayout.className,
        render: (row) => <TruncatedTableCell text={row.company.name} />,
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
        status: statusFilters.length > 0 ? statusFilters : undefined,
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
  }, [page, debouncedSearch, statusFilters, sortBy, sortOrder]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setSortBy(nextSortBy as ProjectListSortBy);
    setSortOrder(nextSortOrder);
    setPage(1);
  }

  function clearDeepLinkParams() {
    if (!deepLinkEditId && !returnTarget) {
      return;
    }

    const params = new URLSearchParams(searchParams.toString());
    params.delete('edit');
    params.delete('return');
    const query = params.toString();
    router.replace(query ? `/projects?${query}` : '/projects');
  }

  function navigateAfterPanelClose() {
    const panouPath = panouPathFromProjectEditReturn(returnTarget);
    if (panouPath) {
      router.push(panouPath);
      return;
    }

    clearDeepLinkParams();
  }

  function openCreate() {
    clearDeepLinkParams();
    setPanel({ open: true, mode: 'create', project: null });
  }

  function openEdit(project: ProjectDto) {
    clearDeepLinkParams();
    setPanel({ open: true, mode: 'edit', project });
  }

  function closePanel() {
    setPanel({ open: false });
    navigateAfterPanelClose();
  }

  function handleSaved(updated?: ProjectDto) {
    if (updated) {
      setProjects((current) => replaceById(current, updated));
      return;
    }

    void loadProjects();
  }

  const hasActiveSearch = debouncedSearch.length > 0;
  const hasActiveStatusFilter = statusFilters.length > 0;
  const showEmptyState = !loading && !error && total === 0 && !hasActiveSearch && !hasActiveStatusFilter;
  const showNoSearchResults =
    !loading && !error && total === 0 && (hasActiveSearch || hasActiveStatusFilter);
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
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <input
            type="search"
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            placeholder="Caută după denumire, cod sau client..."
            aria-label="Caută după denumire, cod sau client"
            className={searchInputClassName}
            {...businessAutofill}
          />
          <SearchableMultiSelect
            id="project-status-filter"
            label="Status"
            placeholder="Filtrează după status…"
            emptyMessage="Niciun status găsit."
            values={statusFilters}
            options={STATUS_FILTER_OPTIONS}
            onChange={(values) => {
              setPage(1);
              setStatusFilters(values as ProjectStatus[]);
            }}
          />
        </div>
      )}

      {showNoSearchResults && (
        <div className="mt-8 flex flex-col items-center justify-center gap-4 text-center">
          <p className="text-sm text-text-muted">
            {hasActiveStatusFilter && !hasActiveSearch
              ? `Niciun proiect pentru statusurile selectate.`
              : 'Nu există proiecte care să corespundă căutării.'}
          </p>
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
            storageKey="projects-list"
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
