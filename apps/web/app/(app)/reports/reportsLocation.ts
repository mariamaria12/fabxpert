import {
  DEFAULT_REPORT_PERIOD,
  isReportPeriodReady,
  reportPeriodToQuery,
  type ReportPeriod,
} from '@fabxpert/shared';
import { OPEN_REPORT_PARAM } from '@/hooks/useOpenReportParam';
import { REPORT_TABS, type ReportTab } from './ReportTabs';

const DAY_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

type ParamReader = { get: (name: string) => string | null };

/** What the Rapoarte address remembers, so Back lands on the same report. */
export type ReportsLocation = {
  tab: ReportTab;
  period: ReportPeriod;
  projectId: string | null;
};

function readPeriod(params: ParamReader): ReportPeriod {
  const kind = params.get('period');
  if (kind === 'lastMonth' || kind === 'currentMonth') {
    return { kind };
  }

  const from = params.get('from');
  const to = params.get('to');
  if (kind === 'custom' && from && to && DAY_KEY_PATTERN.test(from) && DAY_KEY_PATTERN.test(to)) {
    return { kind: 'custom', from, to };
  }

  return DEFAULT_REPORT_PERIOD;
}

/** Anything missing or malformed falls back to the page's defaults. */
export function readReportsLocation(params: ParamReader): ReportsLocation {
  const tab = params.get('tab');
  return {
    tab: REPORT_TABS.find((candidate) => candidate === tab) ?? 'productivity',
    period: readPeriod(params),
    projectId: params.get(OPEN_REPORT_PARAM),
  };
}

/** Defaults are left out, so a plain visit keeps a plain `/reports`. */
export function buildReportsHref(location: ReportsLocation): string {
  const params = new URLSearchParams();

  if (location.tab !== 'productivity') {
    params.set('tab', location.tab);
  }

  if (location.period.kind !== DEFAULT_REPORT_PERIOD.kind && isReportPeriodReady(location.period)) {
    const query = reportPeriodToQuery(location.period);
    params.set('period', query.period);
    if (query.from && query.to) {
      params.set('from', query.from);
      params.set('to', query.to);
    }
  }

  if (location.projectId) {
    params.set(OPEN_REPORT_PARAM, location.projectId);
  }

  const query = params.toString();
  return query ? `/reports?${query}` : '/reports';
}
