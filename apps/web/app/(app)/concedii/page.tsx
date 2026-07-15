'use client';

import { useState } from 'react';
import { LeaveBalancesTab } from './LeaveBalancesTab';
import { LeaveRequestsTab } from './LeaveRequestsTab';
import { useLeavePendingCount } from '@/context/LeavePendingCountContext';

const TABS = [
  { id: 'requests', label: 'Cereri' },
  { id: 'balances', label: 'Solduri' },
] as const;

type ConcediiTab = (typeof TABS)[number]['id'];

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ro-RO', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function ConcediiPage() {
  const { refreshPendingCount } = useLeavePendingCount();
  const [activeTab, setActiveTab] = useState<ConcediiTab>('requests');
  const [balancesRefreshToken, setBalancesRefreshToken] = useState(0);
  const [requestsRefreshToken, setRequestsRefreshToken] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  function refreshBalances() {
    setBalancesRefreshToken((token) => token + 1);
  }

  async function refreshAll() {
    setRefreshing(true);
    setRequestsRefreshToken((token) => token + 1);
    setBalancesRefreshToken((token) => token + 1);

    try {
      await refreshPendingCount();
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-[22px] font-medium text-text-primary">Concedii</h1>
        <div className="flex shrink-0 items-center gap-3">
          {lastUpdated ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              actualizat {formatUpdatedAt(lastUpdated)}
            </span>
          ) : null}
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

      <div className="mt-4 flex gap-1 border-b border-border-subtle">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`border-b-2 px-4 py-2 text-sm transition-colors ${
              activeTab === tab.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="mt-6 flex-1">
        {activeTab === 'requests' ? (
          <LeaveRequestsTab
            refreshToken={requestsRefreshToken}
            onBalancesRefresh={refreshBalances}
          />
        ) : (
          <LeaveBalancesTab refreshToken={balancesRefreshToken} />
        )}
      </div>
    </div>
  );
}
