'use client';

import { getProjectBreakdown, type ProjectBreakdownResponse } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { allTimePeriod } from '@/utils/timesheetListNavigation';

/**
 * What a pinned card shows expanded, under a row of the projects table: the
 * project's activities with their progress and logged hours, since ever.
 * Loaded when the row opens, so a closed table costs nothing extra.
 */
export function ProjectBreakdownRow({ projectId }: { projectId: string }) {
  const [breakdown, setBreakdown] = useState<ProjectBreakdownResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    getProjectBreakdown(projectId)
      .then((response) => {
        if (!cancelled) {
          setBreakdown(response);
        }
      })
      .catch((caught: unknown) => {
        if (!cancelled) {
          setError(apiErrorToastMessage(caught));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  return (
    <div className="px-3 py-2">
      {error ? (
        <p className="text-sm text-danger">{error}</p>
      ) : !breakdown ? (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      ) : breakdown.activities.length === 0 ? (
        <p className="text-sm text-text-muted">Fără ore pontate pe acest proiect.</p>
      ) : (
        <div className="max-w-3xl">
          <ActivityBreakdownRows
            activities={breakdown.activities}
            progressPercent={breakdown.progressPercent}
            timesheets={{ projectId, period: allTimePeriod() }}
          />
        </div>
      )}
    </div>
  );
}
