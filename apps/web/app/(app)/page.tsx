'use client';

import { PanouRefreshProvider, usePanouRefresh } from './PanouRefreshContext';
import { PanouContentViews } from './panou/PanouContentViews';
import { PanouDashboardProvider } from './panou/PanouDashboardContext';
import { PanouMetricCards } from './panou/PanouMetricCards';
import { PanouToolbar } from './panou/PanouToolbar';

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
          <h1 className="text-xl font-semibold tracking-tight text-text-primary">Panou</h1>
          <p className="mt-0.5 hidden text-xs text-text-muted md:block">
            Urmărește proiectele și logurile de timp
          </p>
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
            aria-label="Împrospătare date"
            className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 md:px-3 md:py-2 md:text-sm"
          >
            <i
              className={`ti ti-refresh text-sm md:text-base ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden md:inline">Împrospătare date</span>
          </button>
        </div>
      </div>

      <PanouMetricCards />
      <PanouToolbar />
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
