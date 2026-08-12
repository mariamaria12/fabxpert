import { parseFinisaj, ralBadgeColors } from '@fabxpert/shared';

/**
 * Mobile twin of apps/web/components/FinisajBadge.tsx — same parsing, same
 * colour maths (both from `@fabxpert/shared`), same size, styled with the
 * mobile stylesheet instead of Tailwind.
 */
export function FinisajBadge({
  value,
  compact = false,
}: {
  value: string | null | undefined;
  /** Tight rows (project cards): colour badge only, no action text. */
  compact?: boolean;
}) {
  const parsed = parseFinisaj(value);
  if (!parsed) {
    return null;
  }

  if (parsed.kind === 'plain') {
    return (
      <span className="finisaj-badge finisaj-badge-outline" title={parsed.label}>
        {parsed.label}
      </span>
    );
  }

  const colors = ralBadgeColors(parsed.hex);
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

  if (compact || !parsed.action) {
    return badge;
  }

  return (
    <span className="finisaj-group">
      <span className="finisaj-action">{parsed.action}</span>
      {badge}
    </span>
  );
}
