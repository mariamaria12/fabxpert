import type { Period } from '@fabxpert/shared';
import { useEffect, useRef } from 'react';

/** Where on the panou a project was opened from. */
export type PanouReturnSource = 'pinned' | 'in_progress' | 'completed' | 'hours';

/**
 * The project someone left the panou from, written into the address as a `#`
 * fragment right before the pontaje open. Back then lands on an address that
 * says which card or row to reopen and scroll to — the panou keeps none of
 * that once it is unmounted.
 */
export type PanouReturnPoint = {
  projectId: string;
  source: PanouReturnSource;
  /** Page of the table the row was on. */
  page?: number;
  /** The toolbar period of the hours view. */
  period?: Period;
};

const SOURCES: readonly PanouReturnSource[] = ['pinned', 'in_progress', 'completed', 'hours'];
const NAMED_PERIOD_KINDS = ['today', 'yesterday', 'week', 'month'] as const;
const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** Swaps the fragment of the current history entry; the page behind is not re-rendered. */
function replaceHash(hash: string) {
  const { pathname, search } = window.location;
  window.history.replaceState(null, '', `${pathname}${search}${hash}`);
}

export function writePanouReturnPoint(point: PanouReturnPoint) {
  const params = new URLSearchParams({ project: point.projectId, from: point.source });
  if (point.page && point.page > 1) {
    params.set('page', String(point.page));
  }
  if (point.period?.kind === 'custom') {
    params.set('start', point.period.from);
    params.set('end', point.period.to);
  } else if (point.period) {
    params.set('period', point.period.kind);
  }
  replaceHash(`#${params.toString()}`);
}

/** Reads what `writePanouReturnPoint` wrote; null when the address carries none. */
export function readPanouReturnPoint(): PanouReturnPoint | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const params = new URLSearchParams(window.location.hash.replace(/^#/, ''));
  const projectId = params.get('project');
  const source = SOURCES.find((value) => value === params.get('from'));
  if (!projectId || !source) {
    return null;
  }

  const page = Number.parseInt(params.get('page') ?? '', 10);
  const start = params.get('start');
  const end = params.get('end');
  const namedKind = NAMED_PERIOD_KINDS.find((kind) => kind === params.get('period'));
  const period: Period | undefined =
    start && end && DAY_KEY_PATTERN.test(start) && DAY_KEY_PATTERN.test(end)
      ? { kind: 'custom', from: start, to: end }
      : namedKind
        ? { kind: namedKind }
        : undefined;

  return { projectId, source, page: page > 1 ? page : undefined, period };
}

/** Used once: left in the address, a later Back would reopen a project long since closed. */
export function clearPanouReturnPoint() {
  if (window.location.hash) {
    replaceHash('');
  }
}

/** Scrolls to the reopened project the first time `find` has something to show. */
export function useScrollToReturnProject(find: () => Element | null, ready: boolean) {
  const done = useRef(false);
  const findRef = useRef(find);
  findRef.current = find;

  useEffect(() => {
    if (!ready || done.current) {
      return;
    }

    const target = findRef.current();
    if (target) {
      done.current = true;
      target.scrollIntoView({ block: 'center' });
    }
  }, [ready]);
}

/** DOM id of a project's card, so the panou can scroll back to it. */
export function panouProjectElementId(projectId: string): string {
  return `panou-project-${projectId}`;
}
