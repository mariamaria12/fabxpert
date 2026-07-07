'use client';

import { TodayActivityFeed } from './TodayActivityFeed';

export default function DashboardPage() {
  return (
    <div className="flex h-full flex-col">
      <h1 className="text-[22px] font-medium text-text-primary">Panou</h1>
      <TodayActivityFeed />
    </div>
  );
}
