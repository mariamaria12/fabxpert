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
import { SearchableMultiSelect } from '@/components/SearchableMultiSelect';
import type { SearchableSelectOption } from '@/components/SearchableSelect';
import {
  buildStableIndexMap,
  getRolePaletteColor,
} from '@/components/roleColors';
import { replaceById } from '@/utils/replaceById';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useLazyVisible } from '@/hooks/useLazyVisible';
import { getProjectFormEmployeeRoles } from '@/utils/projectFormLookups';
import {
  IN_PROGRESS_STATUS_FILTER_OPTIONS,
  VISIBILITY_EVERYONE_VALUE,
} from '@/utils/projectStatusFilter';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import {
  PanouPinnedProjectsSection,
  type PanouPinnedProjectsSectionHandle,
} from './PanouPinnedProjectsSection';
import { ProjectPinButton } from './ProjectPinButton';
import { ProjectVisibleForCell } from './panouProjectVisibility';

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
  }
>(function ProjectTableSection(
  { title, statusGroup, showPinColumn = false, showFilters = false, onPinToggled },
  ref,
) {
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<ProjectListSortBy>(DEFAULT_SORT_BY);
  const [sortOrder, setSortOrder] = useState<SortOrder>(DEFAULT_SORT_ORDER);
  const [statusFilters, setStatusFilters] = useState<ProjectStatus[]>([]);
  const [visibilityFilters, setVisibilityFilters] = useState<string[]>([]);
  const [visibilityOptions, setVisibilityOptions] = useState<SearchableSelectOption[]>([
    { id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' },
  ]);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    if (!showFilters) {
      return;
    }

    let cancelled = false;

    void getProjectFormEmployeeRoles()
      .then((roles) => {
        if (cancelled) {
          return;
        }

        const activeRoles = roles.filter((role) => role.isActive);
        const roleColorById = buildStableIndexMap(activeRoles);

        setVisibilityOptions([
          { id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' },
          ...activeRoles.map((role) => ({
            id: role.id,
            label: role.name,
            color: getRolePaletteColor(roleColorById.get(role.id) ?? 0),
          })),
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setVisibilityOptions([{ id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' }]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [showFilters]);

  useEffect(() => {
    setPage(1);
  }, [statusFilters, visibilityFilters]);

  const loadProjects = useCallback(async () => {
    const fetchSeq = ++fetchSeqRef.current;
    setLoading(true);
    setError(null);

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
  }, [page, statusGroup, statusFilters, visibilityFilters, sortBy, sortOrder]);

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

  function handlePinToggled(updated: ProjectDto) {
    setProjects((current) => replaceById(current, updated));
    onPinToggled?.(updated);
  }

  const columnsWithPin = useProjectTableColumns({
    showPinColumn,
    onPinToggled: handlePinToggled,
  });

  const hasActiveFilters = statusFilters.length > 0 || visibilityFilters.length > 0;
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
        <div className="mt-3 grid gap-3 md:grid-cols-2">
          <SearchableMultiSelect
            id={`panou-${statusGroup}-status-filter`}
            label="Status"
            placeholder="Filtrează după status…"
            emptyMessage="Niciun status găsit."
            values={statusFilters}
            options={IN_PROGRESS_STATUS_FILTER_OPTIONS}
            onChange={(values) => setStatusFilters(values as ProjectStatus[])}
          />
          <SearchableMultiSelect
            id={`panou-${statusGroup}-visibility-filter`}
            label="Vizibil pentru"
            placeholder="Filtrează după vizibilitate…"
            emptyMessage="Nicio opțiune găsită."
            values={visibilityFilters}
            options={visibilityOptions}
            onChange={setVisibilityFilters}
          />
        </div>
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
        <p className="mt-3 text-sm text-text-muted">{emptyMessage}</p>
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
      />
      <div ref={completedSection.ref}>
        {completedSection.visible ? (
          <ProjectTableSection
            ref={completedTableRef}
            title="Proiecte finalizate"
            statusGroup="completed"
          />
        ) : (
          <h3 className="text-sm font-medium text-text-secondary">Proiecte finalizate</h3>
        )}
      </div>
    </section>
  );
}
