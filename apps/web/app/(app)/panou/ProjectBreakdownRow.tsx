'use client';

import { getProjectBreakdown, type ProjectBreakdownResponse } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PinnedProjectCard } from './PinnedProjectCard';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

/**
 * Under a row of the projects table: the project as a pinned card, opened —
 * the same card the pinned section shows, whether or not the project is
 * pinned. Loaded when the row opens, so a closed table costs nothing extra.
 */
export function ProjectBreakdownRow({
  projectId,
  source,
  page,
  onEdit,
  onOpenReport,
}: {
  projectId: string;
  /** The table the row sits in, and its page — where Back from the pontaje returns. */
  source: 'in_progress' | 'completed';
  page: number;
  onEdit: () => void;
  onOpenReport: () => void;
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
