'use client';

import { NEUTRAL_ACCENT, panouAccentTint } from './panouColors';

export function PanouActivityProgressBar({
  color,
  percent,
  className = '',
}: {
  color: string | null;
  percent: number;
  className?: string;
}) {
  const fill = color ?? NEUTRAL_ACCENT;
  const width = percent <= 0 ? 0 : Math.max(percent, 6);

  return (
    <div
      className={`h-1 overflow-hidden rounded-full ${className}`}
      style={{ backgroundColor: panouAccentTint(color, '18%') }}
      aria-hidden="true"
    >
      <div
        className="h-full rounded-full transition-[width] duration-300 ease-out"
        style={{
          width: `${width}%`,
          backgroundColor: fill,
        }}
      />
    </div>
  );
}
