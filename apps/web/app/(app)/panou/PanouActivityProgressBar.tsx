'use client';

import { NEUTRAL_ACCENT, panouAccentTint } from './panouColors';

/** Below this the fill is a sliver nobody can see, so it is nudged up to it. */
const MIN_VISIBLE_PERCENT = 6;

export function PanouActivityProgressBar({
  color,
  percent,
  manualPercent = 0,
  className = '',
}: {
  color: string | null;
  percent: number;
  /**
   * The part of `percent` that was ticked by hand instead of pontaged. Drawn as
   * a paler segment at the end of the fill: same progress, visibly another
   * source, so outsourced work never passes for hours worked in the shop.
   */
  manualPercent?: number;
  className?: string;
}) {
  const fill = color ?? NEUTRAL_ACCENT;
  // The minimum applies to the fill as a whole — nudging each segment on its
  // own would let a single manual piece eat a tenth of the bar.
  const width = percent <= 0 ? 0 : Math.max(percent, MIN_VISIBLE_PERCENT);
  const manualShare = percent > 0 ? Math.min(manualPercent, percent) / percent : 0;

  return (
    <div
      className={`flex h-1 overflow-hidden rounded-full ${className}`}
      style={{ backgroundColor: panouAccentTint(color, '18%') }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${width * (1 - manualShare)}%`,
          backgroundColor: fill,
        }}
      />
      {manualShare > 0 && (
        <div
          className="h-full rounded-full transition-[width] duration-300 ease-out"
          style={{
            width: `${width * manualShare}%`,
            backgroundColor: panouAccentTint(color, '45%'),
          }}
        />
      )}
    </div>
  );
}
