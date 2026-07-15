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
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { SortablePinnedProjectCard } from './SortablePinnedProjectCard';

export type PanouPinnedProjectsSectionHandle = {
  refetch: () => Promise<void>;
  removeProject: (projectId: string) => void;
};

export const PanouPinnedProjectsSection = forwardRef<
  PanouPinnedProjectsSectionHandle,
  {
    onProjectUnpinned: (updated: ProjectDto) => void;
  }
>(function PanouPinnedProjectsSection({ onProjectUnpinned }, ref) {
  const { showToast } = useToast();
  const [projects, setProjects] = useState<PinnedProjectSummaryRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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

  return (
    <section className="mt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold text-text-primary">Proiecte</h2>
        {projects.length > 1 && (
          <p className="text-xs text-text-muted">Trage pentru a reordona</p>
        )}
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
            strategy={verticalListSortingStrategy}
          >
            <div className="mt-3 space-y-2">
              {projects.map((project) => (
                <SortablePinnedProjectCard
                  key={project.id}
                  project={project}
                  expanded={expandedIds.has(project.id)}
                  onToggle={() => toggleExpanded(project.id)}
                  onUnpinned={handleUnpinned}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
});
