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
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { ProjectFormPanel } from '../projects/ProjectFormPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { SortablePinnedProjectCard } from './SortablePinnedProjectCard';
import { pinnedSummaryToProjectStub } from './pinnedSummaryToProjectStub';

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
  const fetchSeqRef = useRef(0);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

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
      setProjects(response.projects);
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
  }, []);

  useEffect(() => {
    void loadPinnedSummary();
  }, [loadPinnedSummary]);

  function handleViewModeChange(mode: PanouPinnedViewMode) {
    setViewMode(mode);
    window.localStorage.setItem(PANOU_PINNED_VIEW_MODE_KEY, mode);
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

  async function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = projects.findIndex((project) => project.id === active.id);
    const newIndex = projects.findIndex((project) => project.id === over.id);
    if (oldIndex < 0 || newIndex < 0) {
      return;
    }

    const previous = projects;
    const reordered = arrayMove(projects, oldIndex, newIndex).map((project, index) => ({
      ...project,
      indexPanou: index,
    }));

    setProjects(reordered);

    try {
      await reorderPinnedProjects(reordered.map((project) => project.id));
    } catch (caught) {
      setProjects(previous);
      showToast(apiErrorToastMessage(caught), 'error');
    }
  }

  const showEmptyHint = !loading && !error && projects.length === 0;
  const listClassName =
    viewMode === 'two-columns' ? 'mt-3 grid grid-cols-2 gap-2' : 'mt-3 space-y-2';
  const sortingStrategy =
    viewMode === 'two-columns' ? rectSortingStrategy : verticalListSortingStrategy;

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-text-primary">Proiecte</h2>
        <PanouPinnedViewModeToggle viewMode={viewMode} onChange={handleViewModeChange} />
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
        <p className="mt-3 text-sm text-text-muted">Se încarcă…</p>
      )}

      {showEmptyHint && (
        <p className="mt-3 text-sm text-text-muted">
          Niciun proiect fixat. Folosește pictograma pin din lista de proiecte în curs.
        </p>
      )}

      {projects.length > 0 && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={(event) => void handleDragEnd(event)}
        >
          <SortableContext
            items={projects.map((project) => project.id)}
            strategy={sortingStrategy}
          >
            <div className={listClassName}>
              {projects.map((project) => (
                <SortablePinnedProjectCard
                  key={project.id}
                  project={project}
                  expanded={expandedIds.has(project.id)}
                  onToggle={() => toggleExpanded(project.id)}
                  onUnpinned={handleUnpinned}
                  onEdit={() => openEdit(project)}
                />
              ))}
            </div>
          </SortableContext>
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
