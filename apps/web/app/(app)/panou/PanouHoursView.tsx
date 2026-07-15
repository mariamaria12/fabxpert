'use client';

import { getProjectSummary, type ProjectSummaryProjectRow } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { ProjectHoursCard } from './ProjectHoursCard';
import { usePanouDashboard } from './PanouDashboardContext';

export function PanouHoursView() {
  const { period, periodReady } = usePanouDashboard();
  const [projects, setProjects] = useState<ProjectSummaryProjectRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (background = false) => {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getProjectSummary(period);
        setProjects(response.projects);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [period],
  );

  useEffect(() => {
    if (!periodReady) {
      return;
    }
    void loadSummary();
  }, [loadSummary, period, periodReady]);

  const refetchSummary = useCallback(async () => {
    if (!periodReady) {
      return;
    }
    await loadSummary(true);
  }, [loadSummary, periodReady]);

  useRegisterPanouRefetch('panou-hours', refetchSummary);

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

  const showEmptyState = !loading && !error && projects.length === 0;
  const waitingForCustomRange = !periodReady;

  return (
    <section className="mt-4">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
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

      {waitingForCustomRange && (
        <p className="text-sm text-text-muted">Selectează intervalul de date.</p>
      )}

      {loading && projects.length === 0 && !error && !waitingForCustomRange && (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      )}

      {showEmptyState && (
        <p className="text-sm text-text-muted">Niciun timp logat în perioada selectată.</p>
      )}

      {projects.length > 0 && (
        <div className="space-y-2">
          {projects.map((project) => (
            <ProjectHoursCard
              key={project.id}
              project={project}
              expanded={expandedIds.has(project.id)}
              onToggle={() => toggleExpanded(project.id)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
