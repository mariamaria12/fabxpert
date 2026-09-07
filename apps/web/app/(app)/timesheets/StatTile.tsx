import type { ReactNode } from 'react';

interface StatTileProps {
  label: string;
  icon?: string;
  value: ReactNode;
  hint?: ReactNode;
  /** The figure the tab is about — tinted with the accent. */
  accent?: boolean;
  /** The figure needs attention — tinted amber. */
  warning?: boolean;
}

/** One number with its label, for the summary row above a table. */
export function StatTile({
  label,
  icon,
  value,
  hint,
  accent = false,
  warning = false,
}: StatTileProps) {
  const tone = accent
    ? 'border-primary-border bg-primary-bg'
    : warning
      ? 'border-warning-border bg-warning-bg'
      : 'border-border bg-surface';
  const valueTone = accent
    ? 'text-primary-hover'
    : warning
      ? 'text-warning-text'
      : 'text-text-primary';
  const labelTone = accent
    ? 'text-primary-hover/85'
    : warning
      ? 'text-warning-text/85'
      : 'text-text-muted';

  return (
    <div className={`rounded-lg border px-4 py-3 shadow-card ${tone}`}>
      <div className={`flex items-center gap-1.5 text-xs ${labelTone}`}>
        {icon ? <i className={`ti ${icon} text-sm`} aria-hidden="true" /> : null}
        {label}
      </div>
      <div
        className={`mt-1.5 text-[22px] font-semibold leading-tight tracking-tight tabular-nums ${valueTone}`}
      >
        {value}
      </div>
      {hint ? <div className="mt-1 text-[11px] text-text-muted">{hint}</div> : null}
    </div>
  );
}

export function StatTileRow({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{children}</div>;
}
