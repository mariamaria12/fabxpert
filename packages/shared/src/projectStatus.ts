import type { ProjectStatus } from './dto/project.dto';

export type ProjectStatusMeta = {
  label: string;
  /** Tailwind badge classes using status tokens from tokens.css */
  badgeClassName: string;
};

/** Romanian labels and token-based badge classes for each ProjectStatus value. */
export const PROJECT_STATUS_META: Record<ProjectStatus, ProjectStatusMeta> = {
  CIORNA: {
    label: 'Ciornă',
    badgeClassName: 'border border-status-ciorna-border bg-status-ciorna-bg text-status-ciorna-text',
  },
  IN_OFERTARE: {
    label: 'În ofertare',
    badgeClassName: 'border border-status-in-ofertare-border bg-status-in-ofertare-bg text-status-in-ofertare-text',
  },
  CASTIGAT: {
    label: 'Câștigat',
    badgeClassName: 'border border-status-castigat-border bg-status-castigat-bg text-status-castigat-text',
  },
  IN_PROIECTARE: {
    label: 'În proiectare',
    badgeClassName: 'border border-status-in-proiectare-border bg-status-in-proiectare-bg text-status-in-proiectare-text',
  },
  IN_PRODUCTIE: {
    label: 'În producție',
    badgeClassName: 'border border-status-in-productie-border bg-status-in-productie-bg text-status-in-productie-text',
  },
  PREGATIT_LIVRARE: {
    label: 'Pregătit livrare',
    badgeClassName: 'border border-status-pregatit-livrare-border bg-status-pregatit-livrare-bg text-status-pregatit-livrare-text',
  },
  LIVRAT: {
    label: 'Livrat',
    badgeClassName: 'border border-status-livrat-border bg-status-livrat-bg text-status-livrat-text',
  },
  FINALIZAT: {
    label: 'Finalizat',
    badgeClassName: 'border border-status-finalizat-border bg-status-finalizat-bg text-status-finalizat-text',
  },
  SUSPENDAT: {
    label: 'Suspendat',
    badgeClassName: 'border border-status-suspendat-border bg-status-suspendat-bg text-status-suspendat-text',
  },
  ANULAT: {
    label: 'Anulat',
    badgeClassName: 'border border-status-anulat-border bg-status-anulat-bg text-status-anulat-text',
  },
};

/** Statuses where an overdue due date is no longer highlighted. */
export const PROJECT_TERMINAL_STATUSES: readonly ProjectStatus[] = [
  'LIVRAT',
  'FINALIZAT',
  'ANULAT',
] as const;

/**
 * Statuses that count as finished work, and the ones the Rapoarte analytics
 * cover. `completedAt` is stamped when a project enters this set and cleared
 * when it leaves; reaching FINALIZAT always rewrites it, because that is the
 * date the work was actually finished. Shipping is an external step that can
 * sit for days, so a LIVRAT date is only a stand-in until then.
 *
 * ANULAT is terminal but not finished: cancelled work was never completed.
 */
export const PROJECT_COMPLETED_STATUSES: readonly ProjectStatus[] = [
  'FINALIZAT',
  'LIVRAT',
] as const;

export function isProjectCompletedStatus(status: ProjectStatus): boolean {
  return PROJECT_COMPLETED_STATUSES.includes(status);
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
