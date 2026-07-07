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
    badgeClassName: 'bg-status-ciorna-bg text-status-ciorna-text',
  },
  IN_OFERTARE: {
    label: 'În ofertare',
    badgeClassName: 'bg-status-in-ofertare-bg text-status-in-ofertare-text',
  },
  CASTIGAT: {
    label: 'Câștigat',
    badgeClassName: 'bg-status-castigat-bg text-status-castigat-text',
  },
  IN_PROIECTARE: {
    label: 'În proiectare',
    badgeClassName: 'bg-status-in-proiectare-bg text-status-in-proiectare-text',
  },
  IN_PRODUCTIE: {
    label: 'În producție',
    badgeClassName: 'bg-status-in-productie-bg text-status-in-productie-text',
  },
  PREGATIT_LIVRARE: {
    label: 'Pregătit livrare',
    badgeClassName: 'bg-status-pregatit-livrare-bg text-status-pregatit-livrare-text',
  },
  LIVRAT: {
    label: 'Livrat',
    badgeClassName: 'bg-status-livrat-bg text-status-livrat-text',
  },
  FINALIZAT: {
    label: 'Finalizat',
    badgeClassName: 'bg-status-finalizat-bg text-status-finalizat-text',
  },
  SUSPENDAT: {
    label: 'Suspendat',
    badgeClassName: 'bg-status-suspendat-bg text-status-suspendat-text',
  },
  ANULAT: {
    label: 'Anulat',
    badgeClassName: 'bg-status-anulat-bg text-status-anulat-text',
  },
};

/** Statuses where an overdue due date is no longer highlighted. */
export const PROJECT_TERMINAL_STATUSES: readonly ProjectStatus[] = [
  'LIVRAT',
  'FINALIZAT',
  'ANULAT',
] as const;

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
