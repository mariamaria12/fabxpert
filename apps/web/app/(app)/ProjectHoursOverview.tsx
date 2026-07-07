'use client';

import {
  getProjectSummary,
  type ProjectSummaryPeriod,
  type ProjectSummaryProjectRow,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { useRegisterPanouRefetch } from './PanouRefreshContext';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const PERIOD_OPTIONS: { id: ProjectSummaryPeriod; label: string }[] = [
  { id: 'all', label: 'Toate' },
  { id: 'month', label: 'Luna' },
  { id: 'week', label: 'Săptămâna' },
];

function ProjectHoursCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectSummaryProjectRow;
  expanded: boolean;
  onToggle: () => void;
}) {
  const maxActivityMinutes = Math.max(...project.activities.map((activity) => activity.minutes), 1);

  return (
    <div className="overflow-hidden rounded-md border border-border-subtle bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-raised"
      >
        <span
          className="w-1 self-stretch shrink-0 rounded-full"
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
        <div className="space-y-3 border-t border-border-subtle px-4 py-3">
          {project.activities.map((activity) => (
            <div
              key={`${project.id}-${activity.activityId ?? 'none'}`}
              className="grid grid-cols-[auto_minmax(0,7rem)_1fr_auto] items-center gap-3"
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{
                  background: activity.activityColor ?? 'var(--color-border-subtle)',
                }}
                aria-hidden="true"
              />
              <span className="truncate text-sm text-text-secondary">{activity.activityName}</span>
              <div className="h-2 overflow-hidden rounded-full bg-surface-raised">
                <div
                  className="h-full rounded-full bg-accent/70"
                  style={{
                    width: `${Math.round((activity.minutes / maxActivityMinutes) * 100)}%`,
                  }}
                />
              </div>
              <span className="font-mono text-sm tabular-nums text-text-primary">
                {formatDurationMinutes(activity.minutes)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProjectHoursOverview() {
  const [period, setPeriod] = useState<ProjectSummaryPeriod>('all');
  const [projects, setProjects] = useState<ProjectSummaryProjectRow[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSummary = useCallback(
    async (targetPeriod: ProjectSummaryPeriod, background = false) => {
      if (!background) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getProjectSummary(targetPeriod);
        setProjects(response.projects);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadSummary(period);
  }, [period, loadSummary]);

  const refetchSummary = useCallback(async () => {
    await loadSummary(period, true);
  }, [loadSummary, period]);

  useRegisterPanouRefetch('project-hours', refetchSummary);

  function selectPeriod(nextPeriod: ProjectSummaryPeriod) {
    setPeriod(nextPeriod);
  }

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

  return (
    <section className="mt-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-sm font-medium text-text-secondary">
          Ore logate pe proiecte în curs
        </h2>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-border-subtle bg-surface p-0.5">
            {PERIOD_OPTIONS.map((option) => {
              const isSelected = period === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={isSelected}
                  onClick={() => selectPeriod(option.id)}
                  className={`rounded px-3 py-1.5 text-sm transition-colors ${
                    isSelected
                      ? 'bg-accent/10 text-accent'
                      : 'text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadSummary(period, true)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {loading && projects.length === 0 && !error && (
        <p className="mt-4 text-sm text-text-muted">Se încarcă…</p>
      )}

      {showEmptyState && (
        <p className="mt-4 text-sm text-text-muted">Niciun timp logat în perioada selectată.</p>
      )}

      {projects.length > 0 && (
        <div className="mt-4 space-y-3">
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
