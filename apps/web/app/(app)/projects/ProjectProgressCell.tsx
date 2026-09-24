import { formatProjectProgress } from '@fabxpert/shared';

/** Progress on the assembly list as a thin bar and a percentage; a dash without a list. */
export function ProjectProgressCell({ progressPercent }: { progressPercent: number | null }) {
  if (progressPercent === null) {
    return <span className="text-text-muted">—</span>;
  }

  return (
    <span className="flex items-center gap-2">
      <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${Math.floor(progressPercent)}%` }}
        />
      </span>
      <span className="w-9 shrink-0 text-right text-xs tabular-nums text-text-secondary">
        {formatProjectProgress(progressPercent)}
      </span>
    </span>
  );
}
