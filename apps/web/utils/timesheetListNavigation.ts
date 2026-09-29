import type { Period } from '@fabxpert/shared';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Query params the Pontaje list takes from a link, then drops from the address. */
export const TIMESHEET_LIST_LINK_PARAMS = ['personId', 'projectId', 'from', 'to', 'return'] as const;

/**
 * Pontaje for one person on one project, between two day keys when given.
 * `returnTo` is the page to go back to — only in-app paths are kept.
 */
export function buildTimesheetListHref(filters: {
  personId: string;
  projectId: string;
  from: string | null;
  to: string | null;
  returnTo?: string;
}): string {
  const params = new URLSearchParams({
    personId: filters.personId,
    projectId: filters.projectId,
  });
  if (filters.from && filters.to) {
    params.set('from', filters.from);
    params.set('to', filters.to);
  }
  if (filters.returnTo) {
    params.set('return', filters.returnTo);
  }
  return `/timesheets?${params.toString()}`;
}

export type TimesheetListLink = {
  personId: string | null;
  projectId: string | null;
  period: Period | null;
  returnTo: string | null;
};

/**
 * A path on this site; anything that could leave it is dropped — `//host`, and
 * backslashes, which browsers read as slashes (`/\host`).
 */
function inAppPath(value: string | null): string | null {
  return value && /^\/(?![/\\])[^\\]*$/.test(value) ? value : null;
}

/** Reads what `buildTimesheetListHref` wrote; missing or malformed parts stay null. */
export function readTimesheetListLink(params: {
  get: (name: string) => string | null;
}): TimesheetListLink {
  const from = params.get('from');
  const to = params.get('to');
  const hasDays = from !== null && to !== null && DAY_KEY_PATTERN.test(from) && DAY_KEY_PATTERN.test(to);

  return {
    personId: params.get('personId'),
    projectId: params.get('projectId'),
    period: hasDays ? { kind: 'custom', from, to } : null,
    returnTo: inAppPath(params.get('return')),
  };
}
