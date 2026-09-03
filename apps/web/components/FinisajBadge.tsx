'use client';

import { finisajBadgeColors, parseFinisaj, splitFinisaj } from '@fabxpert/shared';

/**
 * Finish badge. A recognised RAL code renders as a rectangle filled with the
 * actual colour (text contrast derived from its luminance); anything else — and
 * unknown RAL codes — render as an outline badge of the same size, so mixed
 * lists stay even. A finish written as a sum ("Grund AL + zincare") gets one
 * badge per part. Empty values render nothing at all.
 *
 * Mirrored on mobile by apps/mobile/src/components/FinisajBadge.tsx; both use
 * the same parsing and colour maths from `@fabxpert/shared`.
 */
export function FinisajBadge({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  const segments = splitFinisaj(value);
  if (segments.length === 0) {
    return null;
  }

  if (segments.length === 1) {
    return <FinisajSegment value={segments[0]} className={className} />;
  }

  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      {segments.map((segment, index) => (
        <FinisajSegment key={`${segment}-${index}`} value={segment} />
      ))}
    </span>
  );
}

/** One finish: the badge itself, plus the action text when a RAL code carries one. */
function FinisajSegment({ value, className }: { value: string; className?: string }) {
  const parsed = parseFinisaj(value);
  if (!parsed) {
    return null;
  }

  const badgeClass =
    'finisaj-text inline-flex h-5 max-w-[100px] shrink-0 items-center justify-center truncate rounded px-1.5 text-[11px] leading-none';
  const outlineClass = `${badgeClass} border border-border text-text-secondary`;

  if (parsed.kind === 'plain' && !parsed.hex) {
    return (
      <span className={`${outlineClass} ${className ?? ''}`} title={parsed.label}>
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
      title={value}
    >
      {parsed.label}
    </span>
  );

  if (parsed.kind === 'plain' || !parsed.action) {
    return className ? <span className={`inline-flex ${className}`}>{badge}</span> : badge;
  }

  // The rest of the finish stays plain text; only the RAL code carries colour.
  return (
    <span className={`inline-flex min-w-0 items-center gap-1.5 ${className ?? ''}`}>
      <span className="finisaj-text truncate text-[11px] text-text-secondary">
        {parsed.action}
      </span>
      {badge}
    </span>
  );
}
