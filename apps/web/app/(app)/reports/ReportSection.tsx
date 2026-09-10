'use client';

import type { ReactNode } from 'react';

/** The card every Rapoarte block sits in — one title, one optional hint. */
export function SectionCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-border-subtle bg-surface p-3 ${className ?? ''}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        {hint && <span className="shrink-0 text-[10px] text-text-muted">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

export function EmptyHint({ children }: { children: ReactNode }) {
  return <p className="py-4 text-center text-xs text-text-muted">{children}</p>;
}

/**
 * A track with a filled span. `pct` may go past 100 — the fill stops at the
 * track's end while the label keeps the real figure, so an over-reported step
 * is flagged instead of silently trimmed.
 */
export function Bar({
  pct,
  color,
  className,
}: {
  pct: number;
  color: string;
  className?: string;
}) {
  const width = Math.min(Math.max(pct, pct > 0 ? 2 : 0), 100);
  return (
    <span
      className={`relative block h-1.5 overflow-hidden rounded-full bg-surface-raised ${className ?? ''}`}
    >
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${width}%`, backgroundColor: color }}
      />
    </span>
  );
}
