'use client';

import {
  formatProjectComplexity,
  PROJECT_COMPLEXITY_LEVELS,
  projectComplexityLevel,
} from '@fabxpert/shared';
import { formatPiecesPerTon } from '@/utils/projectComplexity';

/**
 * Complexity drawn as a battery with one bar per class, filled up to the
 * project's, and the class beside it (C1–C4). Renders nothing while parts per
 * ton is not filled in.
 */
export function ProjectComplexityBadge({
  piecesPerTon,
  showValue = false,
  className,
}: {
  piecesPerTon: number | null;
  /** Also prints the figure, for tables where the class alone would hide it. */
  showValue?: boolean;
  className?: string;
}) {
  const level = projectComplexityLevel(piecesPerTon);
  if (level === null || piecesPerTon === null) {
    return null;
  }

  const label = formatProjectComplexity(level);
  const value = formatPiecesPerTon(piecesPerTon);
  const description = `Complexitate ${label} · ${value}`;

  return (
    <span
      role="img"
      aria-label={description}
      title={description}
      className={`inline-flex h-5 shrink-0 items-center gap-1.5 whitespace-nowrap text-text-secondary ${className ?? ''}`}
    >
      <svg viewBox="0 0 23 12" className="h-3 w-[23px] shrink-0" aria-hidden="true">
        <rect
          x="0.5"
          y="0.5"
          width="20"
          height="11"
          rx="2.5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1"
        />
        <rect x="21" y="4" width="2" height="4" rx="1" fill="currentColor" />
        {PROJECT_COMPLEXITY_LEVELS.map((entry, index) => (
          <rect
            key={entry.level}
            x={3 + index * 4}
            y="3"
            width="3"
            height="6"
            rx="0.5"
            fill="currentColor"
            opacity={entry.level <= level ? 1 : 0.22}
          />
        ))}
      </svg>
      <span className="text-[11px] font-medium leading-none tabular-nums">{label}</span>
      {showValue && (
        <span className="text-[11px] leading-none tabular-nums text-text-muted">{value}</span>
      )}
    </span>
  );
}
