'use client';

import { finisajBadgeColors, parseFinisaj } from '@fabxpert/shared';

/**
 * Finish badge. A recognised RAL code renders as a rectangle filled with the
 * actual colour (text contrast derived from its luminance); anything else — and
 * unknown RAL codes — render as an outline badge of the same size, so mixed
 * lists stay even. Empty values render nothing at all.
 *
 * Mirrored on mobile by apps/mobile/src/components/FinisajBadge.tsx; both use
 * the same parsing and colour maths from `@fabxpert/shared`.
 */
export function FinisajBadge({
  value,
  compact = false,
  className,
}: {
  value: string | null | undefined;
  /** Tight rows: drop the action text and keep only the colour badge. */
  compact?: boolean;
  className?: string;
}) {
  const parsed = parseFinisaj(value);
  if (!parsed) {
    return null;
  }

  const badgeClass =
    'inline-flex h-5 max-w-[100px] shrink-0 items-center justify-center truncate rounded px-1.5 text-[11px] leading-none';

  if (parsed.kind === 'plain' && !parsed.hex) {
    return (
      <span
        className={`${badgeClass} border border-border text-text-secondary ${className ?? ''}`}
        title={parsed.label}
      >
        {parsed.label}
      </span>
    );
  }

  // Known finishes (zinc plating) fill the rectangle just like a RAL colour.
  const colors = finisajBadgeColors(parsed.hex as string);
  const badge = (
    <span
      className={`${badgeClass} font-medium`}
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        border: colors.border ? `1px solid ${colors.border}` : '1px solid transparent',
      }}
      title={value ?? parsed.label}
    >
      {parsed.label}
    </span>
  );

  if (parsed.kind === 'plain') {
    return className ? <span className={`inline-flex ${className}`}>{badge}</span> : badge;
  }

  if (compact || !parsed.action) {
    return className ? <span className={`inline-flex ${className}`}>{badge}</span> : badge;
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      <span className="truncate text-[11px] text-text-secondary">{parsed.action}</span>
      {badge}
    </span>
  );
}
