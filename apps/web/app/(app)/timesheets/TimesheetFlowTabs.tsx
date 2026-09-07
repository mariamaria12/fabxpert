'use client';

import { Fragment } from 'react';
import { TIMESHEET_TAB_ITEMS, type TimesheetTab } from './timesheetTabs';

interface TimesheetFlowTabsProps {
  active: TimesheetTab;
  onChange: (tab: TimesheetTab) => void;
  /** People still waiting for last month's approval — shown on that step. */
  approvalsPending: number;
}

/**
 * The four steps of the pontaj flow as a numbered rail. They are tabs, but
 * the numbers and the chevrons say the order is not arbitrary: overtime only
 * reaches accounting once it has been approved.
 */
export function TimesheetFlowTabs({ active, onChange, approvalsPending }: TimesheetFlowTabsProps) {
  return (
    <nav
      role="tablist"
      aria-label="Fluxul de pontaj"
      className="inline-flex max-w-full flex-wrap items-center gap-0.5 rounded-lg border border-border bg-surface p-1 shadow-card"
    >
      {TIMESHEET_TAB_ITEMS.map((tab, index) => {
        const isActive = tab.id === active;
        const badge = tab.id === 'approvals' && approvalsPending > 0 ? approvalsPending : null;

        return (
          <Fragment key={tab.id}>
            {index > 0 ? (
              <i
                className="ti ti-chevron-right shrink-0 text-sm text-text-disabled"
                aria-hidden="true"
              />
            ) : null}
            <button
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors ${
                isActive
                  ? 'bg-surface-active font-medium text-primary-hover'
                  : 'text-text-secondary hover:bg-surface-hover hover:text-text-primary'
              }`}
            >
              <span
                className={`flex size-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-semibold tabular-nums ${
                  isActive ? 'bg-accent text-accent-contrast' : 'bg-surface-raised text-text-muted'
                }`}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              {tab.label}
              {badge !== null ? (
                <span className="rounded-full border border-warning-border bg-warning-bg px-1.5 py-0.5 text-[10px] font-semibold leading-none tabular-nums text-warning-text">
                  {badge > 99 ? '99+' : badge}
                </span>
              ) : null}
            </button>
          </Fragment>
        );
      })}
    </nav>
  );
}
