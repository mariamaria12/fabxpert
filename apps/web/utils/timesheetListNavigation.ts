import { workDateToDayKey, type Period } from '@fabxpert/shared';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Query params the Pontaje list takes from a link, then drops from the address. */
export const TIMESHEET_LIST_LINK_PARAMS = [
  'personId',
  'projectId',
  'activityId',
  'period',
  'from',
  'to',
  'return',
] as const;

/** The panou's address — the home page. */
export const PANOU_PATH = '/';

/** The periods a link can name outright; a custom one travels as `from` and `to`. */
const NAMED_PERIOD_KINDS = ['today', 'yesterday', 'week', 'month'] as const;

/**
 * The list has no "since ever" period, so totals that are not tied to one —
 * the pinned cards — link with a range that starts before any pontaj.
 */
export function allTimePeriod(): Period {
  return { kind: 'custom', from: '2000-01-01', to: workDateToDayKey(new Date()) };
}

/** Pontaje of one activity on one project, over the period the caller was looking at. */
export function buildActivityTimesheetListHref(filters: {
  projectId: string;
  activityId: string;
  period: Period;
  returnTo?: string;
}): string {
  const params = new URLSearchParams({
    projectId: filters.projectId,
    activityId: filters.activityId,
  });
  if (filters.period.kind === 'custom') {
    params.set('from', filters.period.from);
    params.set('to', filters.period.to);
  } else {
    params.set('period', filters.period.kind);
  }
  if (filters.returnTo) {
    params.set('return', filters.returnTo);
  }
  return `/timesheets?${params.toString()}`;
}

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
  activityId: string | null;
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

/** Reads what the builders above wrote; missing or malformed parts stay null. */
export function readTimesheetListLink(params: {
  get: (name: string) => string | null;
}): TimesheetListLink {
  const from = params.get('from');
  const to = params.get('to');
  const hasDays = from !== null && to !== null && DAY_KEY_PATTERN.test(from) && DAY_KEY_PATTERN.test(to);

  const namedKind = NAMED_PERIOD_KINDS.find((kind) => kind === params.get('period'));

  return {
    personId: params.get('personId'),
    projectId: params.get('projectId'),
    activityId: params.get('activityId'),
    period: hasDays ? { kind: 'custom', from, to } : namedKind ? { kind: namedKind } : null,
    returnTo: inAppPath(params.get('return')),
  };
}
