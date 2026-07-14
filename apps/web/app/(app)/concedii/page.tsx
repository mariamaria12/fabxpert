'use client';

import { useState } from 'react';
import { LeaveBalancesTab } from './LeaveBalancesTab';
import { LeaveRequestsTab } from './LeaveRequestsTab';

const TABS = [
  { id: 'requests', label: 'Cereri' },
  { id: 'balances', label: 'Solduri' },
] as const;

type ConcediiTab = (typeof TABS)[number]['id'];

export default function ConcediiPage() {
  const [activeTab, setActiveTab] = useState<ConcediiTab>('requests');
  const [balancesRefreshToken, setBalancesRefreshToken] = useState(0);

  function refreshBalances() {
    setBalancesRefreshToken((token) => token + 1);
  }

  return (
    <div className="flex h-full flex-col">
      <h1 className="text-[22px] font-medium text-text-primary">Concedii</h1>

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
          <LeaveRequestsTab onBalancesRefresh={refreshBalances} />
        ) : (
          <LeaveBalancesTab refreshToken={balancesRefreshToken} />
        )}
      </div>
    </div>
  );
}
