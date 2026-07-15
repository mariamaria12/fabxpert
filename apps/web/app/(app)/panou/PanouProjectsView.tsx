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
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { replaceById } from '@/utils/replaceById';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useLazyVisible } from '@/hooks/useLazyVisible';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import {
  PanouPinnedProjectsSection,
  type PanouPinnedProjectsSectionHandle,
} from './PanouPinnedProjectsSection';
import { ProjectPinButton } from './ProjectPinButton';

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

function useProjectTableColumns(options?: {
  showPinColumn?: boolean;
  onPinToggled?: (updated: ProjectDto) => void;
}): DataTableColumn<ProjectDto>[] {
  return useMemo((): DataTableColumn<ProjectDto>[] => {
    const columns: DataTableColumn<ProjectDto>[] = [];

    if (options?.showPinColumn) {
      columns.push({
        key: 'pin',
        header: '',
        width: '44px',
        render: (row) => (
          <ProjectPinButton
            project={row}
            onToggled={(updated) => options.onPinToggled?.(updated)}
          />
        ),
      });
    }

    columns.push(
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
    );

    return columns;
  }, [options?.onPinToggled, options?.showPinColumn]);
}

export type ProjectTableSectionHandle = {
  applyProjectUpdate: (updated: ProjectDto) => void;
};

const ProjectTableSection = forwardRef<
  ProjectTableSectionHandle,
  {
    title: string;
    statusGroup: 'in_progress' | 'completed';
    showPinColumn?: boolean;
    onPinToggled?: (updated: ProjectDto) => void;
  }
>(function ProjectTableSection(
  { title, statusGroup, showPinColumn = false, onPinToggled },
  ref,
) {
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
        compact: true,
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

  useImperativeHandle(
    ref,
    () => ({
      applyProjectUpdate: (updated: ProjectDto) => {
        setProjects((current) => replaceById(current, updated));
      },
    }),
    [],
  );

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setPage(1);
    setSortBy(nextSortBy as ProjectListSortBy);
    setSortOrder(nextSortOrder);
  }

  function handlePinToggled(updated: ProjectDto) {
    setProjects((current) => replaceById(current, updated));
    onPinToggled?.(updated);
  }

  const columnsWithPin = useProjectTableColumns({
    showPinColumn,
    onPinToggled: handlePinToggled,
  });

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
            columns={columnsWithPin}
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
});

export function PanouProjectsView() {
  const pinnedSectionRef = useRef<PanouPinnedProjectsSectionHandle>(null);
  const inProgressTableRef = useRef<ProjectTableSectionHandle>(null);
  const completedSection = useLazyVisible({ rootMargin: '400px' });

  const handlePinToggled = useCallback((updated: ProjectDto) => {
    if (updated.isPinned) {
      void pinnedSectionRef.current?.refetch();
      return;
    }

    pinnedSectionRef.current?.removeProject(updated.id);
  }, []);

  const handleProjectUnpinned = useCallback((updated: ProjectDto) => {
    inProgressTableRef.current?.applyProjectUpdate(updated);
  }, []);

  return (
    <section className="mt-6 space-y-8">
      <PanouPinnedProjectsSection
        ref={pinnedSectionRef}
        onProjectUnpinned={handleProjectUnpinned}
      />
      <ProjectTableSection
        ref={inProgressTableRef}
        title="Proiecte în curs"
        statusGroup="in_progress"
        showPinColumn
        onPinToggled={handlePinToggled}
      />
      <div ref={completedSection.ref}>
        {completedSection.visible ? (
          <ProjectTableSection title="Proiecte finalizate" statusGroup="completed" />
        ) : (
          <h3 className="text-sm font-medium text-text-secondary">Proiecte finalizate</h3>
        )}
      </div>
    </section>
  );
}
