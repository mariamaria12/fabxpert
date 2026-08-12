'use client';

import type {
  ActivityHoursRow,
  ClientHoursRow,
  OnTimeBreakdown,
  ProductivityReportResponse,
  ProjectHoursComparisonRow,
} from '@fabxpert/shared';
import { formatHours } from './reportsFormat';
import { paletteColor, TOKEN, tint } from './reportColors';

const MAX_PROJECT_CARDS = 12;
const MAX_CLIENT_BARS = 6;

function SectionCard({
  title,
  hint,
  className,
  children,
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-border-subtle bg-surface p-3 ${className ?? ''}`}
    >
      <header className="mb-2 flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
          {title}
        </h2>
        {hint && <span className="shrink-0 text-[10px] text-text-muted">{hint}</span>}
      </header>
      {children}
    </section>
  );
}

function EmptyHint({ children }: { children: React.ReactNode }) {
  return <p className="py-4 text-center text-xs text-text-muted">{children}</p>;
}

// --- Ore lucrate vs. estimate — compact cards, two parallel bars ------------

const WORKED_COLOR = TOKEN.accent;
const ESTIMATE_COLOR = TOKEN.info;

function MiniBar({ pct, value, color }: { pct: number; value: string; color: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="relative h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-raised">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(pct, pct > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </span>
      <span className="w-12 shrink-0 text-right text-xs font-medium tabular-nums text-text-secondary">
        {value}
      </span>
    </div>
  );
}

function ProjectCard({ row }: { row: ProjectHoursComparisonRow }) {
  const efficiency =
    row.estimatedMinutes !== null && row.workedMinutes > 0
      ? Math.round((row.estimatedMinutes / row.workedMinutes) * 100)
      : null;
  const tone =
    efficiency === null ? TOKEN.muted : efficiency >= 100 ? TOKEN.success : TOKEN.danger;

  // Both bars share the card's scale so they read as a direct comparison.
  const cardMax = Math.max(row.workedMinutes, row.estimatedMinutes ?? 0, 1);
  const workedPct = (row.workedMinutes / cardMax) * 100;
  const estPct = row.estimatedMinutes !== null ? (row.estimatedMinutes / cardMax) * 100 : 0;

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <span className="block truncate text-xs font-medium text-text-primary" title={row.label}>
            {row.label}
          </span>
          <span className="block truncate text-[11px] text-text-muted" title={row.code}>
            {row.code}
          </span>
        </div>
        {efficiency !== null && (
          <span
            className="shrink-0 rounded px-1 py-px text-[10px] font-semibold tabular-nums"
            style={{ backgroundColor: tint(tone, '18%'), color: tone }}
          >
            {efficiency}%
          </span>
        )}
      </div>

      <div className="mt-1.5 space-y-1">
        <MiniBar
          pct={workedPct}
          value={formatHours(row.workedMinutes)}
          color={WORKED_COLOR}
        />
        {row.estimatedMinutes !== null ? (
          <MiniBar
            pct={estPct}
            value={formatHours(row.estimatedMinutes)}
            color={ESTIMATE_COLOR}
          />
        ) : (
          <p className="pl-0.5 text-[10px] text-text-muted">fără estimare</p>
        )}
      </div>
    </div>
  );
}

function LucratEstimatLegend() {
  return (
    <div className="mb-2 flex items-center gap-3 text-[10px] text-text-muted">
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ backgroundColor: WORKED_COLOR }} />
        Lucrat
      </span>
      <span className="flex items-center gap-1">
        <span className="size-2 rounded-full" style={{ backgroundColor: ESTIMATE_COLOR }} />
        Estimat
      </span>
    </div>
  );
}

function WorkedVsEstimatedSection({
  rows,
  className,
}: {
  rows: ProjectHoursComparisonRow[];
  className?: string;
}) {
  const shown = rows.slice(0, MAX_PROJECT_CARDS);

  return (
    <SectionCard
      title="Ore lucrate vs. estimate"
      hint={rows.length > shown.length ? `Top ${shown.length} din ${rows.length}` : `Top ${shown.length}`}
      className={className}
    >
      {shown.length === 0 ? (
        <EmptyHint>Fără proiecte în interval.</EmptyHint>
      ) : (
        <>
          <LucratEstimatLegend />
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {shown.map((row) => (
              <ProjectCard key={row.id} row={row} />
            ))}
          </div>
        </>
      )}
    </SectionCard>
  );
}

// --- La termen vs. întârziate — compact donut -------------------------------

function CompactDonut({ data }: { data: OnTimeBreakdown }) {
  const total = data.onTime + data.late + data.noDueDate;
  const decided = data.onTime + data.late;
  const onTimePct = decided > 0 ? Math.round((data.onTime / decided) * 100) : null;

  const segments = [
    { label: 'La termen', value: data.onTime, color: TOKEN.success },
    { label: 'Întârziate', value: data.late, color: TOKEN.danger },
    { label: 'Fără termen', value: data.noDueDate, color: TOKEN.muted },
  ].filter((segment) => segment.value > 0);

  let prev = 0;

  return (
    <div className="flex items-center gap-4">
      <svg viewBox="0 0 42 42" className="size-24 shrink-0" role="img" aria-label="La termen vs. întârziate">
        <circle cx="21" cy="21" r="15.9155" fill="none" stroke="var(--color-surface-raised)" strokeWidth="5" />
        {total > 0 &&
          segments.map((segment) => {
            const pct = (segment.value / total) * 100;
            const circle = (
              <circle
                key={segment.label}
                cx="21"
                cy="21"
                r="15.9155"
                fill="none"
                stroke={segment.color}
                strokeWidth="5"
                pathLength={100}
                strokeDasharray={`${pct} ${100 - pct}`}
                strokeDashoffset={25 - prev}
              />
            );
            prev += pct;
            return circle;
          })}
        <text x="21" y="20.5" textAnchor="middle" className="fill-text-primary" style={{ fontSize: '8px', fontWeight: 600 }}>
          {onTimePct === null ? '—' : `${onTimePct}%`}
        </text>
        <text x="21" y="26" textAnchor="middle" className="fill-text-muted" style={{ fontSize: '3.2px' }}>
          la termen
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5 text-xs">
        <LegendRow color={TOKEN.success} label="La termen" value={data.onTime} />
        <LegendRow color={TOKEN.danger} label="Întârziate" value={data.late} />
        {data.noDueDate > 0 && (
          <LegendRow color={TOKEN.muted} label="Fără termen" value={data.noDueDate} />
        )}
      </ul>
    </div>
  );
}

function LegendRow({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <li className="flex items-center gap-2">
      <span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: color }} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-text-secondary">{label}</span>
      <span className="shrink-0 font-medium tabular-nums text-text-primary">{value}</span>
    </li>
  );
}

// --- Ore pe client — compact mini-bars --------------------------------------

function ClientBars({ rows }: { rows: ClientHoursRow[] }) {
  const shown = rows.slice(0, MAX_CLIENT_BARS);
  const scale = shown.reduce((max, row) => Math.max(max, row.workedMinutes), 0);

  return (
    <ul className="space-y-2">
      {shown.map((row, index) => {
        const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;
        const color = row.color ?? paletteColor(index);
        return (
          <li key={row.companyId ?? `others-${index}`}>
            <div className="mb-0.5 flex items-baseline justify-between gap-2">
              <span className="min-w-0 truncate text-[11px] text-text-secondary" title={row.companyName}>
                {row.companyName}
              </span>
              <span className="shrink-0 text-xs font-medium tabular-nums text-text-secondary">
                {formatHours(row.workedMinutes)}
              </span>
            </div>
            <span className="relative block h-1.5 overflow-hidden rounded-full bg-surface-raised">
              <span
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${Math.max(widthPct, widthPct > 0 ? 2 : 0)}%`, backgroundColor: color }}
              />
            </span>
          </li>
        );
      })}
    </ul>
  );
}

// --- Ore pe activitate — compact cards --------------------------------------

function ActivityCard({
  row,
  scale,
  index,
}: {
  row: ActivityHoursRow;
  scale: number;
  index: number;
}) {
  const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;
  const color = row.color ?? paletteColor(index);

  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2">
      <div className="truncate text-[11px] text-text-secondary" title={row.activityName}>
        {row.activityName}
      </div>
      <div className="mt-0.5 text-sm font-semibold tabular-nums text-text-primary">
        {formatHours(row.workedMinutes)}
      </div>
      <span className="relative mt-1.5 block h-1.5 overflow-hidden rounded-full bg-surface-raised">
        <span
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ width: `${Math.max(widthPct, widthPct > 0 ? 2 : 0)}%`, backgroundColor: color }}
        />
      </span>
    </div>
  );
}

function ByActivitySection({ rows, className }: { rows: ActivityHoursRow[]; className?: string }) {
  const scale = rows.reduce((max, row) => Math.max(max, row.workedMinutes), 0);

  return (
    <SectionCard title="Ore pe activitate" hint={`Top ${rows.length}`} className={className}>
      {rows.length === 0 ? (
        <EmptyHint>Fără ore în interval.</EmptyHint>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {rows.map((row, index) => (
            <ActivityCard
              key={row.activityId ?? `others-${index}`}
              row={row}
              scale={scale}
              index={index}
            />
          ))}
        </div>
      )}
    </SectionCard>
  );
}

export default function ReportCharts({ report }: { report: ProductivityReportResponse }) {
  return (
    <div className="grid gap-2 lg:grid-cols-12">
      <WorkedVsEstimatedSection rows={report.projectHours} className="lg:col-span-8" />

      <div className="grid gap-2 lg:col-span-4">
        <SectionCard title="La termen vs. întârziate">
          <CompactDonut data={report.onTime} />
        </SectionCard>
        <SectionCard title="Ore pe client" hint={`Top ${Math.min(report.byClient.length, MAX_CLIENT_BARS)}`}>
          {report.byClient.length === 0 ? (
            <EmptyHint>Fără ore în interval.</EmptyHint>
          ) : (
            <ClientBars rows={report.byClient} />
          )}
        </SectionCard>
      </div>

      <ByActivitySection rows={report.byActivity} className="lg:col-span-12" />
    </div>
  );
}
