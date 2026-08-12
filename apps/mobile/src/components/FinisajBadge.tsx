import { finisajBadgeColors, parseFinisaj } from '@fabxpert/shared';

/**
 * Mobile twin of apps/web/components/FinisajBadge.tsx — same parsing, same
 * colour maths (both from `@fabxpert/shared`), same size, styled with the
 * mobile stylesheet instead of Tailwind.
 */
export function FinisajBadge({
  value,
  chips = false,
}: {
  value: string | null | undefined;
  /** Project rows: the rest of the finish gets its own chip next to the colour one. */
  chips?: boolean;
}) {
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
      title={value ?? parsed.label}
    >
      {parsed.label}
    </span>
  );

  if (parsed.kind === 'plain' || !parsed.action) {
    return badge;
  }

  if (chips) {
    return (
      <span className="finisaj-group">
        {badge}
        <span className="finisaj-badge finisaj-badge-outline" title={parsed.action}>
          {parsed.action}
        </span>
      </span>
    );
  }

  return (
    <span className="finisaj-group">
      <span className="finisaj-action">{parsed.action}</span>
      {badge}
    </span>
  );
}
