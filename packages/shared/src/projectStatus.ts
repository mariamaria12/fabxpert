import type { ProjectStatus } from './dto/project.dto';

export type ProjectStatusMeta = {
  label: string;
  /** Tailwind badge classes using status tokens from tokens.css */
  badgeClassName: string;
};

/** Romanian labels and token-based badge classes for each ProjectStatus value. */
export const PROJECT_STATUS_META: Record<ProjectStatus, ProjectStatusMeta> = {
  IN_PREGATIRE: {
    label: 'În pregătire',
    badgeClassName: 'border border-status-in-pregatire-border bg-status-in-pregatire-bg text-status-in-pregatire-text',
  },
  IN_PRODUCTIE: {
    label: 'În producție',
    badgeClassName: 'border border-status-in-productie-border bg-status-in-productie-bg text-status-in-productie-text',
  },
  FINALIZAT: {
    label: 'Finalizat',
    badgeClassName: 'border border-status-finalizat-border bg-status-finalizat-bg text-status-finalizat-text',
  },
  SUSPENDAT: {
    label: 'Suspendat',
    badgeClassName: 'border border-status-suspendat-border bg-status-suspendat-bg text-status-suspendat-text',
  },
};

/**
 * Statuses where an overdue due date is no longer highlighted: finished work,
 * and work stopped on purpose — a suspended project is not late.
 */
export const PROJECT_TERMINAL_STATUSES: readonly ProjectStatus[] = [
  'FINALIZAT',
  'SUSPENDAT',
] as const;

/**
 * Statuses that count as finished work, and the ones the Rapoarte analytics
 * cover. `completedAt` is stamped when a project enters this set and cleared
 * when it leaves.
 */
export const PROJECT_COMPLETED_STATUSES: readonly ProjectStatus[] = ['FINALIZAT'] as const;

/**
 * Work in the shop right now — what the "ore vs. piese" report watches.
 * Preparation is left out: nothing is being built yet, so there is no
 * physical progress to compare hours against.
 */
export const PROJECT_ACTIVE_STATUSES: readonly ProjectStatus[] = ['IN_PRODUCTIE'] as const;

/**
 * Statuses left out of the Panou "Proiecte în curs" section. Suspended projects
 * stay in it on purpose.
 */
export const PROJECT_IN_PROGRESS_EXCLUDED_STATUSES: readonly ProjectStatus[] = [
  'FINALIZAT',
] as const;

export function isProjectCompletedStatus(status: ProjectStatus): boolean {
  return PROJECT_COMPLETED_STATUSES.includes(status);
}

/**
 * What `readyForExecution` is set to whenever a project is pinned, unpinned or
 * changes status: visible to employees only while it is on the panou and in
 * production. Admins can still change it by hand until the next such change.
 */
export function isProjectAutoReadyForExecution(
  isPinned: boolean,
  status: ProjectStatus,
): boolean {
  return isPinned && status === 'IN_PRODUCTIE';
}

export function getProjectStatusLabel(status: ProjectStatus): string {
  return PROJECT_STATUS_META[status].label;
}

export function getProjectStatusBadgeClassName(status: ProjectStatus): string {
  return PROJECT_STATUS_META[status].badgeClassName;
}

export function isProjectDueDateOverdue(
  dueDate: string | null,
  status: ProjectStatus,
  now = new Date(),
): boolean {
  if (!dueDate || PROJECT_TERMINAL_STATUSES.includes(status)) {
    return false;
  }

  const due = new Date(dueDate);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
  return dueDay < today;
}

/** Short Romanian due date, e.g. "15 iul" */
export function formatProjectDueDate(dueDate: string): string {
  return new Date(dueDate)
    .toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' })
    .replace(/\./g, '')
    .trim();
}
