'use client';

import { formatTaskCount } from '@fabxpert/shared';
import Link from 'next/link';
import { useTasks } from '@/context/TasksContext';
import { taskHref } from '@/utils/taskNavigation';

interface ProjectTasksLinkProps {
  projectId: string;
  /** `cell` sits in a table column; `icon` is the compact button on a card. */
  variant: 'cell' | 'icon';
}

function describe(openCount: number, overdueCount: number): string {
  const open = `${formatTaskCount(openCount)} ${openCount === 1 ? 'deschis' : 'deschise'}`;
  if (overdueCount === 0) {
    return open;
  }
  return `${open}, ${overdueCount} ${overdueCount === 1 ? 'întârziat' : 'întârziate'}`;
}

/**
 * A project's open tasks, linking to them. Overdue ones turn it red — the
 * office blockers shown next to the production progress. A project with no
 * tasks offers to start one instead (table) or shows nothing (card).
 */
export function ProjectTasksLink({ projectId, variant }: ProjectTasksLinkProps) {
  const { projectTaskCounts } = useTasks();
  const counts = projectTaskCounts.get(projectId);

  if (!counts) {
    if (variant === 'icon') {
      return null;
    }
    return (
      <Link
        href={taskHref({ projectId, create: true })}
        onClick={(event) => event.stopPropagation()}
        aria-label="Task nou pe acest proiect"
        title="Task nou pe acest proiect"
        className="inline-flex size-7 items-center justify-center rounded text-text-disabled transition-colors hover:bg-surface hover:text-text-primary"
      >
        <i className="ti ti-plus text-sm" aria-hidden="true" />
      </Link>
    );
  }

  const { openCount, overdueCount } = counts;
  const label = describe(openCount, overdueCount);
  const tone = overdueCount > 0 ? 'text-danger' : 'text-text-secondary';

  if (variant === 'icon') {
    return (
      <Link
        href={taskHref({ projectId })}
        onClick={(event) => event.stopPropagation()}
        aria-label={label}
        title={label}
        className={`flex h-7 shrink-0 items-center justify-center gap-1 rounded-md px-1 text-xs font-medium tabular-nums transition-colors hover:bg-surface-raised ${tone}`}
      >
        <i className="ti ti-list-check text-lg leading-none" aria-hidden="true" />
        {openCount}
      </Link>
    );
  }

  return (
    <Link
      href={taskHref({ projectId })}
      onClick={(event) => event.stopPropagation()}
      aria-label={label}
      title={label}
      className="inline-flex items-center gap-1.5 rounded px-1.5 py-1 text-sm tabular-nums transition-colors hover:bg-surface"
    >
      <i className={`ti ti-list-check text-base ${tone}`} aria-hidden="true" />
      <span className="text-text-secondary">{openCount}</span>
      {overdueCount > 0 ? (
        <span className="inline-flex items-center gap-0.5 text-xs font-medium text-danger">
          <i className="ti ti-alert-triangle text-xs" aria-hidden="true" />
          {overdueCount}
        </span>
      ) : null}
    </Link>
  );
}
