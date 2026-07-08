'use client';

import { PanouRefreshProvider, usePanouRefresh } from './PanouRefreshContext';
import { PanouContentViews } from './panou/PanouContentViews';
import { PanouDashboardProvider } from './panou/PanouDashboardContext';
import { PanouMetricCards } from './panou/PanouMetricCards';
import { PanouPeriodFilter } from './panou/PanouPeriodFilter';

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function DashboardPageContent() {
  const { refreshAll, refreshing, lastUpdated } = usePanouRefresh();

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-xs text-text-muted">Tablou de bord</p>
          <h1 className="text-[22px] font-medium text-text-primary">Panou</h1>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {lastUpdated && (
            <span className="hidden text-xs text-text-muted sm:inline">
              actualizat {formatUpdatedAt(lastUpdated)}
            </span>
          )}
          <button
            type="button"
            disabled={refreshing}
            onClick={() => void refreshAll()}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
          >
            <i
              className={`ti ti-refresh text-base ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            Împrospătare date
          </button>
        </div>
      </div>

      <PanouMetricCards />
      <PanouPeriodFilter />
      <PanouContentViews />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PanouRefreshProvider>
      <PanouDashboardProvider>
        <DashboardPageContent />
      </PanouDashboardProvider>
    </PanouRefreshProvider>
  );
}
