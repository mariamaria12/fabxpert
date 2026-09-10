'use client';

import {
  DEFAULT_REPORT_PERIOD,
  getProductivityReport,
  isReportPeriodReady,
  type ProductivityReportResponse,
  type ReportPeriod,
} from '@fabxpert/shared';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { ActiveProjectsView } from './ActiveProjectsView';
import { ActivityNormsView } from './ActivityNormsView';
import { ProjectReportPanel } from './ProjectReportPanel';
import { ReportPeriodFilter } from './ReportPeriodFilter';
import { ReportKpiCards } from './ReportKpiCards';
import { ReportTabs, type ReportTab } from './ReportTabs';
import { ChartsSkeleton, KpiRowSkeleton } from './ReportsSkeleton';
import { periodHeading } from './reportsFormat';

// Charts carry no external dependency, but loading them on demand keeps the
// visualization code out of everything but this route.
const ReportCharts = dynamic(() => import('./ReportCharts'), {
  ssr: false,
  loading: () => <ChartsSkeleton />,
});

function EmptyState() {
  return (
    <div className="mt-3 flex flex-col items-center justify-center gap-2 rounded-lg border border-border-subtle bg-surface py-16 text-center">
      <i className="ti ti-chart-bar-off text-3xl text-text-muted" aria-hidden="true" />
      <p className="text-sm text-text-secondary">
        Niciun proiect livrat sau finalizat în intervalul selectat.
      </p>
      <p className="text-xs text-text-muted">Alege alt interval din selectorul de mai sus.</p>
    </div>
  );
}

function ProductivityTab({
  onSelectProject,
}: {
  onSelectProject: (projectId: string) => void;
}) {
  const [period, setPeriod] = useState<ReportPeriod>(DEFAULT_REPORT_PERIOD);
  const [report, setReport] = useState<ProductivityReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const periodReady = isReportPeriodReady(period);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getProductivityReport(period);
      setReport(response);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    if (!periodReady) {
      return;
    }
    void loadReport();
  }, [loadReport, periodReady]);

  const isEmpty = !loading && !error && report !== null && report.kpis.completedCount === 0;

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        {report ? (
          <p className="text-sm text-text-muted">
            {periodHeading(report.period, report.from, report.to)}
          </p>
        ) : (
          <span />
        )}
        <ReportPeriodFilter value={period} onChange={setPeriod} />
      </div>

      <div className="mt-2">
        {!periodReady && (
          <p className="text-sm text-text-muted">Selectează intervalul de date.</p>
        )}

        {periodReady && error && (
          <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
            <p className="text-sm text-danger">{error}</p>
            <button
              type="button"
              onClick={() => void loadReport()}
              className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
            >
              Reîncearcă
            </button>
          </div>
        )}

        {periodReady && !error && loading && (
          <div className="space-y-2">
            <KpiRowSkeleton />
            <ChartsSkeleton />
          </div>
        )}

        {periodReady && !error && !loading && isEmpty && <EmptyState />}

        {periodReady && !error && !loading && report && !isEmpty && (
          <div className="space-y-2">
            <ReportKpiCards kpis={report.kpis} />
            <ReportCharts report={report} onSelectProject={onSelectProject} />
          </div>
        )}
      </div>
    </>
  );
}

export function ReportsView() {
  const [tab, setTab] = useState<ReportTab>('productivity');
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);

  return (
    <div className="flex h-full flex-col">
      <h1 className="hidden text-[22px] font-medium text-text-primary sm:block">Rapoarte</h1>

      <div className="mt-4">
        <ReportTabs value={tab} onChange={setTab} />
      </div>

      <div className="mt-6 flex-1">
        {tab === 'productivity' && (
          <ProductivityTab onSelectProject={setSelectedProjectId} />
        )}
        {tab === 'active' && <ActiveProjectsView onSelectProject={setSelectedProjectId} />}
        {tab === 'norms' && <ActivityNormsView />}
      </div>

      <ProjectReportPanel
        projectId={selectedProjectId}
        onClose={() => setSelectedProjectId(null)}
      />
    </div>
  );
}
