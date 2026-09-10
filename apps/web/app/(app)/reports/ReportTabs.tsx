'use client';

export const REPORT_TABS = ['productivity', 'active', 'norms'] as const;
export type ReportTab = (typeof REPORT_TABS)[number];

const TAB_LABELS: Record<ReportTab, { label: string; icon: string }> = {
  productivity: { label: 'Productivitate', icon: 'ti-chart-bar' },
  active: { label: 'Proiecte active', icon: 'ti-progress' },
  norms: { label: 'Normative', icon: 'ti-scale' },
};

/** Underlined tabs, the same rail Concedii and Administrare use. */
export function ReportTabs({
  value,
  onChange,
}: {
  value: ReportTab;
  onChange: (tab: ReportTab) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Secțiuni rapoarte"
      className="flex gap-1 overflow-x-auto border-b border-border-subtle"
    >
      {REPORT_TABS.map((tab) => {
        const isActive = tab === value;
        return (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(tab)}
            className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm transition-colors ${
              isActive
                ? 'border-accent text-accent'
                : 'border-transparent text-text-muted hover:text-text-secondary'
            }`}
          >
            <i className={`ti ${TAB_LABELS[tab].icon} text-base`} aria-hidden="true" />
            {TAB_LABELS[tab].label}
          </button>
        );
      })}
    </div>
  );
}
