'use client';

import {
  getPinnedProjectsSummary,
  reorderPinnedProjects,
  type PinnedProjectSummaryRow,
  type ProjectDto,
} from '@fabxpert/shared';
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ProjectFormPanel } from '../projects/ProjectFormPanel';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/SearchableSelect';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import {
  flattenPinnedProjectsForOneColumn,
  getPinnedProjectColumn,
  isPinnedLayoutCollapsedToOneColumn,
  mergePinnedProjectColumns,
  splitPinnedProjectsByColumn,
  unflattenOneColumnOrderToColumns,
} from './panouPinnedLayout';
import { SortablePinnedProjectCard } from './SortablePinnedProjectCard';
import { PanouPinnedProjectsSkeleton } from './PanouPinnedProjectsSkeleton';
import { pinnedSummaryToProjectStub } from './pinnedSummaryToProjectStub';

const READY_FOR_EXECUTION_OPTIONS: SearchableSelectOption[] = [
  { id: 'true', label: 'Da' },
  { id: 'false', label: 'Nu' },
];

type EditPanelState =
  | { open: false }
  | { open: true; project: ProjectDto };

type PanouPinnedViewMode = 'one-column' | 'two-columns';

const PANOU_PINNED_VIEW_MODE_KEY = 'panou-pinned-projects-view-mode';

function readStoredViewMode(): PanouPinnedViewMode {
  if (typeof window === 'undefined') {
    return 'one-column';
  }

  const stored = window.localStorage.getItem(PANOU_PINNED_VIEW_MODE_KEY);
  return stored === 'two-columns' ? 'two-columns' : 'one-column';
}

function PanouPinnedViewModeToggle({
  viewMode,
  onChange,
}: {
  viewMode: PanouPinnedViewMode;
  onChange: (mode: PanouPinnedViewMode) => void;
}) {
  const buttonClass = (active: boolean) =>
    `flex size-7 items-center justify-center rounded transition-colors ${
      active
        ? 'bg-accent/15 text-accent'
        : 'text-text-muted hover:bg-surface-raised hover:text-text-secondary'
    }`;

  return (
    <div
      className="flex items-center gap-0.5 rounded-md border border-border-subtle p-0.5"
      role="group"
      aria-label="Mod afișare proiecte"
    >
      <button
        type="button"
        className={buttonClass(viewMode === 'one-column')}
        aria-label="O coloană"
        aria-pressed={viewMode === 'one-column'}
        onClick={() => onChange('one-column')}
      >
        <i className="ti ti-layout-list text-base" aria-hidden="true" />
      </button>
      <button
        type="button"
        className={buttonClass(viewMode === 'two-columns')}
        aria-label="Două coloane"
        aria-pressed={viewMode === 'two-columns'}
        onClick={() => onChange('two-columns')}
      >
        <i className="ti ti-layout-grid text-base" aria-hidden="true" />
      </button>
    </div>
  );
}

function renderPinnedProjectCards(
  columnProjects: PinnedProjectSummaryRow[],
  options: {
    expandedIds: Set<string>;
    toggleExpanded: (projectId: string) => void;
    handleUnpinned: (updated: ProjectDto) => void;
    openEdit: (project: PinnedProjectSummaryRow) => void;
  },
) {
  return columnProjects.map((project) => (
    <SortablePinnedProjectCard
      key={project.id}
      project={project}
      expanded={options.expandedIds.has(project.id)}
      onToggle={() => options.toggleExpanded(project.id)}
      onUnpinned={options.handleUnpinned}
      onEdit={() => options.openEdit(project)}
    />
  ));
}

export type PanouPinnedProjectsSectionHandle = {
  refetch: () => Promise<void>;
  removeProject: (projectId: string) => void;
};

export const PanouPinnedProjectsSection = forwardRef<
  PanouPinnedProjectsSectionHandle,
  {
    onProjectUnpinned: (updated: ProjectDto) => void;
    onProjectUpdated?: (updated: ProjectDto) => void;
  }
>(function PanouPinnedProjectsSection({ onProjectUnpinned, onProjectUpdated }, ref) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<PinnedProjectSummaryRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editPanel, setEditPanel] = useState<EditPanelState>({ open: false });
  const [viewMode, setViewMode] = useState<PanouPinnedViewMode>(() => readStoredViewMode());
  const [readyForExecution, setReadyForExecution] = useState<boolean | null>(null);
  const fetchSeqRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleProjects = useMemo(() => {
    if (readyForExecution === null) {
      return projects;
    }
    return projects.filter((project) => project.readyForExecution === readyForExecution);
  }, [projects, readyForExecution]);

  const [column0, column1] = useMemo(
    () => splitPinnedProjectsByColumn(visibleProjects),
    [visibleProjects],
  );
  const oneColumnProjects = useMemo(
    () => flattenPinnedProjectsForOneColumn(visibleProjects),
    [visibleProjects],
  );
  const canReorder = readyForExecution === null;
  const readyForExecutionValue =
    readyForExecution === null ? null : readyForExecution ? 'true' : 'false';

  const loadPinnedSummary = useCallback(async (background = false) => {
    const fetchSeq = ++fetchSeqRef.current;
    if (!background) {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await getPinnedProjectsSummary();
      if (fetchSeq !== fetchSeqRef.current) {
        return;
      }

      let nextProjects = response.projects;
      const [rawColumn0, rawColumn1] = splitPinnedProjectsByColumn(nextProjects);
      if (
        readStoredViewMode() === 'two-columns' &&
        isPinnedLayoutCollapsedToOneColumn(rawColumn0, rawColumn1)
      ) {
        const [nextColumn0, nextColumn1] = unflattenOneColumnOrderToColumns(rawColumn0);
        try {
          await reorderPinnedProjects([
            nextColumn0.map((project) => project.id),
            nextColumn1.map((project) => project.id),
          ]);
          nextProjects = mergePinnedProjectColumns(nextColumn0, nextColumn1);
        } catch (repairError) {
          showToast(apiErrorToastMessage(repairError), 'error');
        }
      }

      setProjects(nextProjects);
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
  }, [showToast]);

  useEffect(() => {
    void loadPinnedSummary();
  }, [loadPinnedSummary]);

  function handleViewModeChange(mode: PanouPinnedViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(PANOU_PINNED_VIEW_MODE_KEY, mode);

    if (mode === 'two-columns') {
      const [rawColumn0, rawColumn1] = splitPinnedProjectsByColumn(projects);
      if (isPinnedLayoutCollapsedToOneColumn(rawColumn0, rawColumn1)) {
        const [nextColumn0, nextColumn1] = unflattenOneColumnOrderToColumns(rawColumn0);
        void persistColumnOrder(nextColumn0, nextColumn1);
      }
    }
  }

  const refetchSummary = useCallback(async () => {
    await loadPinnedSummary(true);
  }, [loadPinnedSummary]);

  useRegisterPanouRefetch('panou-pinned-projects', refetchSummary);

  useImperativeHandle(
    ref,
    () => ({
      refetch: refetchSummary,
      removeProject: (projectId: string) => {
        setProjects((current) => current.filter((project) => project.id !== projectId));
      },
    }),
    [refetchSummary],
  );

  function toggleExpanded(projectId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  function handleUnpinned(updated: ProjectDto) {
    setProjects((current) => current.filter((project) => project.id !== updated.id));
    onProjectUnpinned(updated);
  }

  function openEdit(project: PinnedProjectSummaryRow) {
    setEditPanel({ open: true, project: pinnedSummaryToProjectStub(project) });
  }

  function closeEditPanel() {
    setEditPanel({ open: false });
  }

  function handleProjectSaved(updated?: ProjectDto) {
    if (updated) {
      onProjectUpdated?.(updated);
      if (!updated.isPinned) {
        setProjects((current) => current.filter((project) => project.id !== updated.id));
      }
    }

    void refetchSummary();
  }

  async function persistColumnOrder(
    nextColumn0: PinnedProjectSummaryRow[],
    nextColumn1: PinnedProjectSummaryRow[],
  ) {
    const previous = projects;
    setProjects(mergePinnedProjectColumns(nextColumn0, nextColumn1));

    try {
      await reorderPinnedProjects([
        nextColumn0.map((project) => project.id),
        nextColumn1.map((project) => project.id),
      ]);
    } catch (caught) {
      setProjects(previous);
      showToast(apiErrorToastMessage(caught), 'error');
    }
  }

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!canReorder || !over || active.id === over.id) {
      return;
    }

    if (viewMode === 'one-column') {
      const oldIndex = oneColumnProjects.findIndex((project) => project.id === active.id);
      const newIndex = oneColumnProjects.findIndex((project) => project.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      const reordered = arrayMove(oneColumnProjects, oldIndex, newIndex);
      const [nextColumn0, nextColumn1] = unflattenOneColumnOrderToColumns(reordered);
      await persistColumnOrder(nextColumn0, nextColumn1);
      return;
    }

    const activeColumn = getPinnedProjectColumn(visibleProjects, String(active.id));
    const overColumn = getPinnedProjectColumn(visibleProjects, String(over.id));
    if (activeColumn === null || overColumn === null || activeColumn !== overColumn) {
      return;
    }

    if (activeColumn === 0) {
      const oldIndex = column0.findIndex((project) => project.id === active.id);
      const newIndex = column0.findIndex((project) => project.id === over.id);
      if (oldIndex < 0 || newIndex < 0) {
        return;
      }

      await persistColumnOrder(arrayMove(column0, oldIndex, newIndex), column1);
      return;
    }

    const oldIndex = column1.findIndex((project) => project.id === active.id);
    const newIndex = column1.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    await persistColumnOrder(column0, arrayMove(column1, oldIndex, newIndex));
  }

  const showEmptyHint = !loading && !error && projects.length === 0;
  const showFilteredEmpty =
    !loading && !error && projects.length > 0 && visibleProjects.length === 0;
  const cardOptions = {
    expandedIds,
    toggleExpanded,
    handleUnpinned,
    openEdit,
  };

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-2">
        <h2 className="text-sm font-semibold text-text-primary">Proiecte</h2>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-44">
            <SearchableSelect
              id="panou-pinned-ready-for-execution-filter"
              label="Gata de execuție"
              placeholder="Toate"
              emptyMessage="Nicio opțiune găsită."
              value={readyForExecutionValue}
              options={READY_FOR_EXECUTION_OPTIONS}
              onChange={(value) => {
                if (value === 'true') {
                  setReadyForExecution(true);
                  return;
                }
                if (value === 'false') {
                  setReadyForExecution(false);
                  return;
                }
                setReadyForExecution(null);
              }}
            />
          </div>
          <PanouPinnedViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
        </div>
      </div>

      {error && (
        <div className="mt-3 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void refetchSummary()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading && projects.length === 0 && !error && (
        <PanouPinnedProjectsSkeleton viewMode={viewMode} />
      )}

      {showEmptyHint && (
        <p className="mt-3 text-sm text-text-muted">
          Niciun proiect fixat. Folosește pictograma pin din lista de proiecte în curs.
        </p>
      )}

      {showFilteredEmpty && (
        <p className="mt-3 text-sm text-text-muted">
          Niciun proiect fixat pentru filtrul selectat.
        </p>
      )}

      {visibleProjects.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          {viewMode === 'one-column' ? (
            <SortableContext
              items={oneColumnProjects.map((project) => project.id)}
              strategy={verticalListSortingStrategy}
              disabled={!canReorder}
            >
              <div className="mt-3 space-y-2">
                {renderPinnedProjectCards(oneColumnProjects, cardOptions)}
              </div>
            </SortableContext>
          ) : (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <SortableContext
                items={column0.map((project) => project.id)}
                strategy={verticalListSortingStrategy}
                disabled={!canReorder}
              >
                <div className="min-w-0 space-y-2">
                  {renderPinnedProjectCards(column0, cardOptions)}
                </div>
              </SortableContext>
              <SortableContext
                items={column1.map((project) => project.id)}
                strategy={verticalListSortingStrategy}
                disabled={!canReorder}
              >
                <div className="min-w-0 space-y-2">
                  {renderPinnedProjectCards(column1, cardOptions)}
                </div>
              </SortableContext>
            </div>
          )}
        </DndContext>
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
    </section>
  );
});
