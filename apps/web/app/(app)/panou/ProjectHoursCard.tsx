'use client';

import type { ProjectSummaryActivityRow, ProjectStatus } from '@fabxpert/shared';
import { PROJECT_TERMINAL_STATUSES } from '@fabxpert/shared';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import { panouAccentTint } from './panouColors';
import { PanouProjectCard } from './PanouProjectCard';

export type ProjectHoursCardProject = {
  id: string;
  name: string;
  code: string;
  color: string | null;
  status: ProjectStatus;
  company: { name: string };
  totalMinutes: number;
  activities: ProjectSummaryActivityRow[];
};

export function ProjectHoursCard({
  project,
  expanded,
  onToggle,
}: {
  project: ProjectHoursCardProject;
  expanded: boolean;
  onToggle: () => void;
}) {
  const showStatusBadge = PROJECT_TERMINAL_STATUSES.includes(project.status);
  const color = project.color ?? '#8c8a80';

  return (
    <PanouProjectCard
      accentColor={project.color}
      title={project.code}
      status={showStatusBadge ? project.status : undefined}
      subtitle={project.company.name}
      totalMinutes={project.totalMinutes}
      expanded={expanded}
      onToggle={onToggle}
      leadingSlot={
        <span
          className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md"
          style={{
            backgroundColor: panouAccentTint(project.color, '24%'),
            color,
          }}
          aria-hidden="true"
        >
          <i className="ti ti-tools text-base" />
        </span>
      }
      expandedContent={<ActivityBreakdownRows activities={project.activities} />}
    />
  );
}
