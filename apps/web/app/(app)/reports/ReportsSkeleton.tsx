'use client';

function Shimmer({ className }: { className: string }) {
  return <div className={`animate-pulse rounded bg-surface-raised ${className}`} />;
}

export function KpiRowSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <div
          key={index}
          className="space-y-1.5 rounded-lg border border-border-subtle bg-surface px-3 py-2"
        >
          <Shimmer className="h-2.5 w-20" />
          <Shimmer className="h-6 w-12" />
        </div>
      ))}
    </div>
  );
}

function CardBlockSkeleton({
  rows,
  cols,
  className,
}: {
  rows: number;
  cols: number;
  className?: string;
}) {
  return (
    <div
      className={`rounded-lg border border-border-subtle bg-surface p-3 ${className ?? ''}`}
      aria-hidden="true"
    >
      <Shimmer className="mb-2 h-3 w-32" />
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }, (_, index) => (
          <Shimmer key={index} className="h-12 w-full" />
        ))}
      </div>
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid gap-2 lg:grid-cols-12" aria-label="Se încarcă rapoartele" aria-busy="true">
      <CardBlockSkeleton rows={3} cols={4} className="lg:col-span-8" />
      <div className="grid gap-2 lg:col-span-4">
        <CardBlockSkeleton rows={1} cols={1} />
        <CardBlockSkeleton rows={4} cols={1} />
      </div>
      <CardBlockSkeleton rows={2} cols={6} className="lg:col-span-12" />
    </div>
  );
}
