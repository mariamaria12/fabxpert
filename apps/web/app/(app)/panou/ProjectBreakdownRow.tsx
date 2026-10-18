'use client';

import { getProjectBreakdown, type ProjectBreakdownResponse } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { allTimePeriod } from '@/utils/timesheetListNavigation';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import { PinnedProjectCard } from './PinnedProjectCard';

/**
 * Under a row of the projects table: the project as a pinned card, opened —
 * the same card the pinned section shows, whether or not the project is
 * pinned. Loaded when the row opens, so a closed table costs nothing extra.
 * Under a details row, which already shows the project, only the hours and
 * progress per activity are added.
 */
export function ProjectBreakdownRow({
  projectId,
  source,
  page,
  onEdit,
  onOpenReport,
  activitiesOnly = false,
}: {
  projectId: string;
  /** The table the row sits in, and its page — where Back from the pontaje returns. */
  source: 'in_progress' | 'completed';
  page: number;
  onEdit: () => void;
  onOpenReport: () => void;
  /** Leave out the card's header — name, client, status — when the row shows them. */
  activitiesOnly?: boolean;
}) {
  const [project, setProject] = useState<ProjectBreakdownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const load = useCallback(async () => {
    try {
      setProject(await getProjectBreakdown(projectId));
      setError(null);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    }
  }, [projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="px-3 py-3">
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !project ? (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      ) : activitiesOnly ? (
        project.activities.length > 0 ? (
          <ActivityBreakdownRows
            activities={project.activities}
            progressPercent={project.progressPercent}
            timesheets={{
              projectId,
              period: allTimePeriod(),
              returnPoint: { projectId, source, page },
            }}
          />
        ) : (
          <p className="text-sm text-text-muted">
            {formatDurationMinutes(project.totalMinutes)} total logat
          </p>
        )
      ) : (
        <PinnedProjectCard
          project={project}
          expanded={expanded}
          onToggle={() => setExpanded((current) => !current)}
          // The pin lives in the table row above; a second one here would have
          // to keep both in step.
          showPinButton={false}
          onUnpinned={() => undefined}
          onEdit={onEdit}
          onOpenReport={onOpenReport}
          onAssembliesChanged={() => void load()}
          returnPoint={{ projectId, source, page }}
        />
      )}
    </div>
  );
}
