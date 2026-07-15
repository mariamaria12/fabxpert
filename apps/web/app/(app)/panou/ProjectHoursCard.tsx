'use client';

import type { ProjectSummaryActivityRow, ProjectStatus } from '@fabxpert/shared';
import { PROJECT_TERMINAL_STATUSES } from '@fabxpert/shared';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
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

  return (
    <PanouProjectCard
      accentColor={project.color}
      title={project.name}
      status={showStatusBadge ? project.status : undefined}
      subtitle={`${project.code} · ${project.company.name}`}
      totalMinutes={project.totalMinutes}
      expanded={expanded}
      onToggle={onToggle}
      expandedContent={<ActivityBreakdownRows activities={project.activities} />}
    />
  );
}
