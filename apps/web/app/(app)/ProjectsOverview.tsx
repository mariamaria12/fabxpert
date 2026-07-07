'use client';

import {
  formatProjectDueDate,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
  listProjects,
  type ProjectDto,
  type ProjectStatusGroup,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
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

const FILTER_OPTIONS: { id: ProjectStatusGroup; label: string; emptyMessage: string }[] = [
  {
    id: 'in_progress',
    label: 'În curs',
    emptyMessage: 'Niciun proiect în curs.',
  },
  {
    id: 'completed',
    label: 'Finalizate',
    emptyMessage: 'Niciun proiect finalizat.',
  },
];

export function ProjectsOverview() {
  const [statusGroup, setStatusGroup] = useState<ProjectStatusGroup>('in_progress');
  const [page, setPage] = useState(1);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState<Record<ProjectStatusGroup, number>>({
    in_progress: 0,
    completed: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const projectColumns = useMemo((): DataTableColumn<ProjectDto>[] => {
    return [
      {
        key: 'name',
        header: 'Denumire',
        render: (row) => <span className="font-medium">{row.name}</span>,
      },
      {
        key: 'code',
        header: 'Cod',
        width: '120px',
        className: 'font-mono text-xs text-text-secondary',
        render: (row) => row.code,
      },
      {
        key: 'startDate',
        header: 'Dată începere',
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
        width: '90px',
        render: (row) => <DueDateCell project={row} />,
      },
      {
        key: 'status',
        header: 'Status',
        width: '150px',
        render: (row) => <ProjectStatusBadge status={row.status} />,
      },
    ];
  }, []);

  const loadCounts = useCallback(async () => {
    const [inProgressResponse, completedResponse] = await Promise.all([
      listProjects({ page: 1, pageSize: 1, statusGroup: 'in_progress' }),
      listProjects({ page: 1, pageSize: 1, statusGroup: 'completed' }),
    ]);

    setCounts({
      in_progress: inProgressResponse.meta.total,
      completed: completedResponse.meta.total,
    });
  }, []);

  const loadProjects = useCallback(async (targetPage: number, group: ProjectStatusGroup) => {
    setLoading(true);
    setError(null);

    try {
      const response = await listProjects({
        page: targetPage,
        pageSize: PAGE_SIZE,
        statusGroup: group,
      });
      setProjects(response.data);
      setTotal(response.meta.total);
      setCounts((current) => ({ ...current, [group]: response.meta.total }));
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCounts().catch(() => {});
  }, [loadCounts]);

  useEffect(() => {
    void loadProjects(page, statusGroup);
  }, [page, statusGroup, loadProjects]);

  function selectFilter(group: ProjectStatusGroup) {
    setStatusGroup(group);
    setPage(1);
  }

  const activeFilter = FILTER_OPTIONS.find((option) => option.id === statusGroup)!;
  const showDataTable = loading || total > 0;
  const showEmptyState = !loading && !error && total === 0;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-medium text-text-secondary">Proiecte</h2>

      <div className="mt-3 grid max-w-lg grid-cols-2 gap-3">
        {FILTER_OPTIONS.map((option) => {
          const isSelected = statusGroup === option.id;
          return (
            <button
              key={option.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => selectFilter(option.id)}
              className={`flex flex-col items-start rounded-md border px-4 py-3 text-left transition-colors ${
                isSelected
                  ? 'border-accent/20 bg-accent/10 text-accent'
                  : 'border-border-subtle bg-surface text-text-secondary hover:bg-surface-raised hover:text-text-primary'
              }`}
            >
              <span className="text-sm font-medium">{option.label}</span>
              <span className="mt-1 text-2xl font-medium tabular-nums">{counts[option.id]}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadProjects(page, statusGroup)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {showEmptyState && (
        <p className="mt-6 text-sm text-text-muted">{activeFilter.emptyMessage}</p>
      )}

      {showDataTable && (
        <div className="mt-6">
          <DataTable
            columns={projectColumns}
            data={projects}
            rowKey={(row) => row.id}
            rowAccentColor={(row) => row.color ?? 'var(--color-border-subtle)'}
            loading={loading}
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
    </section>
  );
}
