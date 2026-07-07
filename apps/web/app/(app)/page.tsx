'use client';

import { TodayActivityFeed } from './TodayActivityFeed';
import { ProjectsOverview } from './ProjectsOverview';
import { ProjectHoursOverview } from './ProjectHoursOverview';
import { PanouRefreshProvider, usePanouRefresh } from './PanouRefreshContext';

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
        <h1 className="text-[22px] font-medium text-text-primary">Panou</h1>
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
      <ProjectsOverview />
      <ProjectHoursOverview />
      <TodayActivityFeed />
    </div>
  );
}

export default function DashboardPage() {
  return (
    <PanouRefreshProvider>
      <DashboardPageContent />
    </PanouRefreshProvider>
  );
}
