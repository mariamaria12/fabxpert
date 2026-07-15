'use client';

type PanouPinnedViewMode = 'one-column' | 'two-columns';

function PinnedProjectCardSkeleton() {
  return (
    <div
      className="overflow-hidden rounded-lg border border-border-subtle bg-surface shadow-sm shadow-black/10"
      aria-hidden="true"
    >
      <div className="flex items-stretch">
        <div className="w-0.5 shrink-0 self-stretch animate-pulse bg-surface-raised" />
        <div className="flex min-w-0 flex-1 items-start gap-2.5 px-3 py-2.5">
          <div className="mt-0.5 flex shrink-0 items-center gap-0.5">
            <div className="size-8 animate-pulse rounded-md bg-surface-raised" />
            <div className="size-8 animate-pulse rounded-md bg-surface-raised" />
          </div>

          <div className="min-w-0 flex-1 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <div className="h-3.5 w-20 animate-pulse rounded bg-surface-raised" />
              <div className="h-4 w-14 animate-pulse rounded bg-surface-raised" />
            </div>
            <div className="h-2.5 w-24 animate-pulse rounded bg-surface-raised" />
            <div className="space-y-1 pt-0.5">
              <div className="h-2.5 w-28 animate-pulse rounded bg-surface-raised" />
              <div className="h-2 w-32 animate-pulse rounded bg-surface-raised" />
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-end gap-0.5 self-start">
            <div className="size-6 animate-pulse rounded-md bg-surface-raised" />
            <div className="flex items-center gap-1">
              <div className="space-y-1">
                <div className="ml-auto h-3 w-10 animate-pulse rounded bg-surface-raised" />
                <div className="ml-auto h-2 w-12 animate-pulse rounded bg-surface-raised" />
              </div>
              <div className="size-6 animate-pulse rounded bg-surface-raised" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PinnedProjectColumnSkeleton({ count }: { count: number }) {
  return (
    <div className="min-w-0 space-y-2">
      {Array.from({ length: count }, (_, index) => (
        <PinnedProjectCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function PanouPinnedProjectsSkeleton({
  viewMode,
  columnCount = 3,
}: {
  viewMode: PanouPinnedViewMode;
  columnCount?: number;
}) {
  if (viewMode === 'two-columns') {
    return (
      <div
        className="mt-3 grid grid-cols-2 gap-2"
        aria-busy="true"
        aria-label="Se încarcă proiectele fixate"
      >
        <PinnedProjectColumnSkeleton count={columnCount} />
        <PinnedProjectColumnSkeleton count={columnCount} />
      </div>
    );
  }

  return (
    <div
      className="mt-3 space-y-2"
      aria-busy="true"
      aria-label="Se încarcă proiectele fixate"
    >
      <PinnedProjectColumnSkeleton count={columnCount * 2} />
    </div>
  );
}
