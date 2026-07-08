'use client';

import { getProjectSummary, type ProjectSummaryProjectRow } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import { usePanouDashboard } from './PanouDashboardContext';

function ProjectHoursCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectSummaryProjectRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
      >
        <span
          className="w-1 shrink-0 self-stretch rounded-full"
          style={{ background: project.color ?? 'var(--color-border-subtle)' }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-text-primary">{project.name}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-text-muted">
            {project.code} · {project.company.name}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <div className="text-right">
            <p className="font-mono text-base font-medium text-text-primary">
              {formatDurationMinutes(project.totalMinutes)}
            </p>
            <p className="text-xs text-text-muted">total logat</p>
          </div>
          <i
            className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-base text-text-muted`}
            aria-hidden="true"
          />
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border-subtle px-4 py-3">
          <ActivityBreakdownRows activities={project.activities} />
        </div>
      )}
    </div>
  );
}

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
    <section className="mt-6">
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
        <div className="space-y-3">
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
