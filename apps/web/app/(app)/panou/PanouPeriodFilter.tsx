'use client';

import { PeriodFilter } from '@/components/PeriodFilter';
import { usePanouDashboard } from './PanouDashboardContext';

export function PanouPeriodFilter() {
  const { showPeriodSelector, period, setPeriod } = usePanouDashboard();

  if (!showPeriodSelector) {
    return null;
  }

  return <PeriodFilter value={period} onChange={setPeriod} className="mt-6" />;
}
