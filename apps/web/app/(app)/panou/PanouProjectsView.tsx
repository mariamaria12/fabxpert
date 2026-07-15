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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';

const PAGE_SIZE = 20;
const DEFAULT_SORT_BY: ProjectListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

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

function useProjectTableColumns(): DataTableColumn<ProjectDto>[] {
  return useMemo(
    (): DataTableColumn<ProjectDto>[] => [
      {
        key: 'name',
        header: 'Proiect',
        sortKey: 'name',
        render: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: 'code',
        header: 'Cod',
        sortKey: 'code',
        width: '120px',
        className: 'font-mono text-xs text-text-secondary',
        render: (row) => row.code,
      },
      {
        key: 'company',
        header: 'Client',
        sortKey: 'company',
        className: 'text-text-secondary',
        render: (row) => row.company.name,
      },
      {
        key: 'startDate',
        header: 'Dată începere',
        sortKey: 'startDate',
        width: '110px',
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
        key: 'status',
        header: 'Status',
        width: '150px',
        render: (row) => <ProjectStatusBadge status={row.status} />,
      },
    ],
    [],
  );
}

function ProjectTableSection({
  title,
  statusGroup,
}: {
  title: string;
  statusGroup: 'in_progress' | 'completed';
}) {
  const columns = useProjectTableColumns();
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProjectListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSeqRef = useRef(0);

  const loadProjects = useCallback(async () => {
    const fetchSeq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects({
        page,
        pageSize: PAGE_SIZE,
        statusGroup,
        sortBy,
        sortOrder,
      });
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }
      setProjects(response.data);
      setTotal(response.meta.total);
    } catch (caught) {
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }
      setError(apiErrorToastMessage(caught));
    } finally {
      if (fetchSeq === fetchSeqRef.current) {
        setLoading(false);
      }
    }
  }, [page, statusGroup, sortBy, sortOrder]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useRegisterPanouRefetch(`panou-projects-${statusGroup}`, loadProjects);

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setPage(1);
    setSortBy(nextSortBy as ProjectListSortBy);
    setSortOrder(nextSortOrder);
  }

  const emptyMessage =
    statusGroup === 'in_progress'
      ? 'Niciun proiect în curs.'
      : 'Niciun proiect finalizat.';

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary">{title}</h3>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
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

      {!loading && !error && total === 0 && (
        <p className="mt-3 text-sm text-text-muted">{emptyMessage}</p>
      )}

      {(loading || total > 0) && (
        <div className="mt-3">
          <DataTable
            columns={columns}
            data={projects}
            rowKey={(row) => row.id}
            rowAccentColor={(row) => row.color ?? 'var(--color-border-subtle)'}
            loading={loading}
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
    </div>
  );
}

export function PanouProjectsView() {
  return (
    <section className="mt-6 space-y-8">
      <ProjectTableSection title="Proiecte în curs" statusGroup="in_progress" />
      <ProjectTableSection title="Proiecte finalizate" statusGroup="completed" />
    </section>
  );
}
