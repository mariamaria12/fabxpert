'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { useOvertimePendingCount } from '@/context/OvertimePendingCountContext';
import { AccountingTimesheetTab } from './AccountingTimesheetTab';
import { OvertimeApprovalsTab } from './OvertimeApprovalsTab';
import { OvertimeBalancesTab } from './OvertimeBalancesTab';
import { TimesheetFlowTabs } from './TimesheetFlowTabs';
import { TimesheetListTab } from './TimesheetListTab';
import { DEFAULT_TIMESHEET_TAB, parseTimesheetTab, type TimesheetTab } from './timesheetTabs';

/**
 * Pontaj → Ore suplimentare → Aprobări → Contabilitate, one page with a step
 * rail. Each step mounts the first time it is opened and stays mounted, so
 * switching back keeps its filters and loaded data.
 */
export default function TimesheetsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { pendingCount } = useOvertimePendingCount();
  const activeTab = parseTimesheetTab(searchParams.get('tab'));
  const [activatedTabs, setActivatedTabs] = useState<Set<TimesheetTab>>(() => new Set([activeTab]));

  useEffect(() => {
    setActivatedTabs((current) => {
      if (current.has(activeTab)) {
        return current;
      }
      const next = new Set(current);
      next.add(activeTab);
      return next;
    });
  }, [activeTab]);

  const setActiveTab = useCallback(
    (tab: TimesheetTab) => {
      const params = new URLSearchParams(searchParams.toString());
      if (tab === DEFAULT_TIMESHEET_TAB) {
        params.delete('tab');
      } else {
        params.set('tab', tab);
      }
      const query = params.toString();
      router.replace(query ? `/timesheets?${query}` : '/timesheets');
    },
    [router, searchParams],
  );

  return (
    <div className="flex h-full flex-col">
      <TimesheetFlowTabs
        active={activeTab}
        onChange={setActiveTab}
        approvalsPending={pendingCount}
      />

      <div className="mt-5 min-h-0 flex-1">
        {activatedTabs.has('timesheets') && (
          <div hidden={activeTab !== 'timesheets'}>
            <TimesheetListTab />
          </div>
        )}

        {activatedTabs.has('overtime') && (
          <div hidden={activeTab !== 'overtime'}>
            <OvertimeBalancesTab active={activeTab === 'overtime'} />
          </div>
        )}

        {activatedTabs.has('approvals') && (
          <div hidden={activeTab !== 'approvals'}>
            <OvertimeApprovalsTab
              active={activeTab === 'approvals'}
              onOpenAccounting={() => setActiveTab('accounting')}
            />
          </div>
        )}

        {activatedTabs.has('accounting') && (
          <div hidden={activeTab !== 'accounting'}>
            <AccountingTimesheetTab
              active={activeTab === 'accounting'}
              onOpenApprovals={() => setActiveTab('approvals')}
            />
          </div>
        )}
      </div>
    </div>
  );
}
