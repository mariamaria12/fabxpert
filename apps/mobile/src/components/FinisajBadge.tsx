import { finisajBadgeColors, parseFinisaj, splitFinisaj } from '@fabxpert/shared';

/**
 * Mobile twin of apps/web/components/FinisajBadge.tsx — same parsing, same
 * colour maths (both from `@fabxpert/shared`), same size, styled with the
 * mobile stylesheet instead of Tailwind.
 */
export function FinisajBadge({ value }: { value: string | null | undefined }) {
  const segments = splitFinisaj(value);
  if (segments.length === 0) {
    return null;
  }

  if (segments.length === 1) {
    return <FinisajSegment value={segments[0]} />;
  }

  // "Grund AL + zincare" — one badge per finish.
  return (
    <span className="finisaj-group">
      {segments.map((segment, index) => (
        <FinisajSegment key={`${segment}-${index}`} value={segment} />
      ))}
    </span>
  );
}

/** One finish: the badge itself, plus the action text when a RAL code carries one. */
function FinisajSegment({ value }: { value: string }) {
  const parsed = parseFinisaj(value);
  if (!parsed) {
    return null;
  }

  if (parsed.kind === 'plain' && !parsed.hex) {
    return (
      <span className="finisaj-badge finisaj-badge-outline" title={parsed.label}>
        {parsed.label}
      </span>
    );
  }

  // Known finishes (zinc plating) fill the rectangle just like a RAL colour.
  const colors = finisajBadgeColors(parsed.hex as string);
  const badge = (
    <span
      className="finisaj-badge finisaj-badge-ral"
      style={{
        backgroundColor: colors.background,
        color: colors.text,
        borderColor: colors.border ?? 'transparent',
      }}
      title={value}
    >
      {parsed.label}
    </span>
  );

  if (parsed.kind === 'plain' || !parsed.action) {
    return badge;
  }

  // The rest of the finish stays plain text; only the RAL code carries colour.
  return (
    <span className="finisaj-group">
      <span className="finisaj-action">{parsed.action}</span>
      {badge}
    </span>
  );
}
