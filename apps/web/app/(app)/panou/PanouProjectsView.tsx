'use client';

import {
  formatProjectDueDate,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
  listProjects,
  type ProjectDto,
  type ProjectListSortBy,
  type ProjectStatus,
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
import {
  ProjectNameCell,
  projectClientTableColumnLayout,
  projectCodeTableColumnLayout,
  projectNameTableColumnLayout,
  TruncatedTableCell,
} from '@/components/ProjectNameCell';
import { Pagination } from '@/components/Pagination';
import { ProjectListFilters } from '@/components/ProjectListFilters';
import { replaceById } from '@/utils/replaceById';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useLazyVisible } from '@/hooks/useLazyVisible';
import { IN_PROGRESS_STATUS_FILTER_OPTIONS } from '@/utils/projectStatusFilter';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { ProjectFormPanel } from '../projects/ProjectFormPanel';
import {
  PanouPinnedProjectsSection,
  type PanouPinnedProjectsSectionHandle,
} from './PanouPinnedProjectsSection';
import { ProjectPinButton } from './ProjectPinButton';
import { ProjectVisibleForCell } from './panouProjectVisibility';

const PAGE_SIZE = 20;
const DEFAULT_SORT_BY: ProjectListSortBy = 'name';
const DEFAULT_SORT_ORDER: SortOrder = 'asc';

type EditPanelState = { open: false } | { open: true; project: ProjectDto };
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
  const showPinColumn = options?.showPinColumn;
  const onPinToggled = options?.onPinToggled;

  return useMemo((): DataTableColumn<ProjectDto>[] => {
    const columns: DataTableColumn<ProjectDto>[] = [];

    if (showPinColumn) {
      columns.push({
        key: 'pin',
        header: '',
        width: '44px',
        render: (row) => (
          <ProjectPinButton
            project={row}
            onToggled={(updated) => onPinToggled?.(updated)}
          />
        ),
      });
    }

    columns.push(
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
      {
        key: 'visibleForRoles',
        header: 'Vizibil pentru',
        width: '200px',
        className: 'text-text-secondary overflow-visible',
        render: (row) => <ProjectVisibleForCell roles={row.visibleForRoles} />,
      },
    );

    return columns;
  }, [onPinToggled, showPinColumn]);
}

export type ProjectTableSectionHandle = {
  applyProjectUpdate: (updated: ProjectDto) => void;
  refetch: () => void;
};

const ProjectTableSection = forwardRef<
  ProjectTableSectionHandle,
  {
    title: string;
    statusGroup: 'in_progress' | 'completed';
    showPinColumn?: boolean;
    showFilters?: boolean;
    onPinToggled?: (updated: ProjectDto) => void;
    onProjectUpdated?: (updated: ProjectDto) => void;
  }
>(function ProjectTableSection(
  { title, statusGroup, showPinColumn = false, showFilters = false, onPinToggled, onProjectUpdated },
  ref,
) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProjectListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [statusFilters, setStatusFilters] = useState<ProjectStatus[]>([]);
  const [visibilityFilters, setVisibilityFilters] = useState<string[]>([]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [readyForExecution, setReadyForExecution] = useState<boolean | null>(null);
  const [editPanel, setEditPanel] = useState<EditPanelState>({ open: false });
  const fetchSeqRef = useRef(0);

  const loadProjects = useCallback(async () => {
    const fetchSeq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);
    let keepLoadingForPageClamp = false;

    try {
      const response = await listProjects({
        page,
        pageSize: PAGE_SIZE,
        statusGroup,
        status: statusFilters.length > 0 ? statusFilters : undefined,
        visibleFor:
          visibilityFilters.length > 0
            ? (visibilityFilters as Array<'everyone' | string>)
            : undefined,
        readyForExecution: readyForExecution ?? undefined,
        sortBy,
        sortOrder,
      });
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }

      // Filter/sort can shrink the result set below the current page.
      if (response.data.length === 0 && response.meta.total > 0 && page > 1) {
        keepLoadingForPageClamp = true;
        setPage(1);
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
      if (fetchSeq === fetchSeqRef.current && !keepLoadingForPageClamp) {
        setLoading(false);
      }
    }
  }, [
    page,
    statusGroup,
    statusFilters,
    visibilityFilters,
    readyForExecution,
    sortBy,
    sortOrder,
  ]);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  useRegisterPanouRefetch(`panou-projects-${statusGroup}`, loadProjects);

  useImperativeHandle(
    ref,
    () => ({
      applyProjectUpdate: (updated: ProjectDto) => {
        const belongsToSection =
          statusGroup === 'completed'
            ? updated.status === 'FINALIZAT'
            : updated.status !== 'FINALIZAT';

        setProjects((current) => {
          const exists = current.some((project) => project.id === updated.id);

          if (!belongsToSection) {
            return current.filter((project) => project.id !== updated.id);
          }

          if (exists) {
            return replaceById(current, updated);
          }

          return current;
        });
      },
      refetch: () => {
        void loadProjects();
      },
    }),
    [loadProjects, statusGroup],
  );

  function handleSortChange(nextSortBy: string, nextSortOrder: SortOrder) {
    setPage(1);
    setSortBy(nextSortBy as ProjectListSortBy);
    setSortOrder(nextSortOrder);
  }

  function handleStatusFiltersChange(values: ProjectStatus[]) {
    setPage(1);
    setStatusFilters(values);
  }

  function handleVisibilityFiltersChange(values: string[]) {
    setPage(1);
    setVisibilityFilters(values);
  }

  function handleReadyForExecutionChange(value: boolean | null) {
    setPage(1);
    setReadyForExecution(value);
  }

  function handlePinToggled(updated: ProjectDto) {
    setProjects((current) => replaceById(current, updated));
    onPinToggled?.(updated);
  }

  function openEdit(project: ProjectDto) {
    setEditPanel({ open: true, project });
  }

  function closeEditPanel() {
    setEditPanel({ open: false });
  }

  function handleProjectSaved(updated?: ProjectDto) {
    if (updated) {
      onProjectUpdated?.(updated);
    }
    closeEditPanel();
    void loadProjects();
  }
  const columnsWithPin = useProjectTableColumns({
    showPinColumn,
    onPinToggled: handlePinToggled,
  });

  const hasActiveFilters =
    statusFilters.length > 0 || visibilityFilters.length > 0 || readyForExecution !== null;
  const emptyMessage =
    statusGroup === 'in_progress'
      ? hasActiveFilters
        ? 'Niciun proiect în curs pentru filtrele selectate.'
        : 'Niciun proiect în curs.'
      : 'Niciun proiect finalizat.';

  return (
    <div>
      <h3 className="text-sm font-medium text-text-secondary">{title}</h3>

      {showFilters && (
        <ProjectListFilters
          idPrefix={`panou-${statusGroup}`}
          className="mt-3"
          statusOptions={IN_PROGRESS_STATUS_FILTER_OPTIONS}
          statusValues={statusFilters}
          onStatusChange={handleStatusFiltersChange}
          visibilityValues={visibilityFilters}
          onVisibilityChange={handleVisibilityFiltersChange}
          readyForExecution={readyForExecution}
          onReadyForExecutionChange={handleReadyForExecutionChange}
        />
      )}

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
        <div className="mt-6 mb-2 flex min-h-[7rem] flex-col items-center justify-center rounded-md border border-dashed border-border-subtle px-4 py-8 text-center">
          <p className="text-sm text-text-muted">{emptyMessage}</p>
        </div>
      )}

      {(loading || total > 0) && (
        <div className="mt-3">
          <DataTable
            storageKey="panou-projects"
            columns={columnsWithPin}
            data={projects}
            rowKey={(row) => row.id}
            rowAccentColor={(row) => row.color ?? 'var(--color-border-subtle)'}
            loading={loading}
            emptyMessage={emptyMessage}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSortChange={handleSortChange}
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

      {editPanel.open ? (
        <ProjectFormPanel
          open
          mode="edit"
          project={editPanel.project}
          onClose={closeEditPanel}
          onSaved={handleProjectSaved}
        />
      ) : null}
    </div>
  );
});

export function PanouProjectsView() {
  const pinnedSectionRef = useRef<PanouPinnedProjectsSectionHandle>(null);
  const inProgressTableRef = useRef<ProjectTableSectionHandle>(null);
  const completedTableRef = useRef<ProjectTableSectionHandle>(null);
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
    completedTableRef.current?.applyProjectUpdate(updated);

    if (updated.status === 'FINALIZAT') {
      completedTableRef.current?.refetch();
    }
  }, []);

  const handlePinnedProjectUpdated = useCallback((updated: ProjectDto) => {
    inProgressTableRef.current?.applyProjectUpdate(updated);
    completedTableRef.current?.applyProjectUpdate(updated);

    if (updated.status === 'FINALIZAT') {
      completedTableRef.current?.refetch();
    }
  }, []);

  const handleTableProjectUpdated = useCallback(
    (updated: ProjectDto) => {
      if (updated.isPinned) {
        void pinnedSectionRef.current?.refetch();
      } else {
        pinnedSectionRef.current?.removeProject(updated.id);
      }

      handlePinnedProjectUpdated(updated);
    },
    [handlePinnedProjectUpdated],
  );

  return (
    <section className="mt-6 space-y-8">
      <PanouPinnedProjectsSection
        ref={pinnedSectionRef}
        onProjectUnpinned={handleProjectUnpinned}
        onProjectUpdated={handlePinnedProjectUpdated}
      />
      <ProjectTableSection
        ref={inProgressTableRef}
        title="Proiecte în curs"
        statusGroup="in_progress"
        showPinColumn
        showFilters
        onPinToggled={handlePinToggled}
        onProjectUpdated={handleTableProjectUpdated}
      />
      <div ref={completedSection.ref}>
        {completedSection.visible ? (
          <ProjectTableSection
            ref={completedTableRef}
            title="Proiecte finalizate"
            statusGroup="completed"
            onProjectUpdated={handleTableProjectUpdated}
          />
        ) : (
          <h3 className="text-sm font-medium text-text-secondary">Proiecte finalizate</h3>
        )}
      </div>
    </section>
  );
}
