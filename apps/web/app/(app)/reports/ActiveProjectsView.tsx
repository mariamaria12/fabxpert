'use client';

import {
  getActiveProjectsReport,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  type ActiveProjectRow,
  type ActiveProjectStepRow,
  type ActiveProjectsReportResponse,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { Bar, EmptyHint, SectionCard } from './ReportSection';
import { paletteColor, TOKEN, tint } from './reportColors';
import {
  formatDaysToDue,
  formatGap,
  formatHours,
  formatPct,
  formatTons,
  gapTone,
} from './reportsFormat';

const HOURS_COLOR = TOKEN.accent;
const WORK_COLOR = TOKEN.info;

function LabelledBar({
  label,
  pct,
  color,
  detail,
}: {
  label: string;
  pct: number | null;
  color: string;
  detail: string;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[11px] text-text-secondary">{label}</span>
        <span className="text-xs font-medium tabular-nums text-text-primary">
          {formatPct(pct)}
        </span>
      </div>
      <Bar pct={pct ?? 0} color={color} className="mt-1" />
      <p className="mt-0.5 text-[10px] text-text-muted">{detail}</p>
    </div>
  );
}

function StepRow({ step, index }: { step: ActiveProjectStepRow; index: number }) {
  const color = step.color ?? paletteColor(index);
  const overDone = step.progressPct > 100;

  return (
    <li className="flex items-center gap-2">
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="min-w-0 flex-1 truncate text-[11px] text-text-secondary">
        {step.activityName}
      </span>
      <span className="shrink-0 text-[10px] tabular-nums text-text-muted">
        {step.progress.weightTotalKg > 0
          ? `${formatTons(step.progress.weightDoneKg)} / ${formatTons(step.progress.weightTotalKg)}`
          : `${step.progress.piecesDone}/${step.progress.piecesTotal} buc`}
      </span>
      <span
        className="w-10 shrink-0 text-right text-[11px] font-medium tabular-nums"
        style={{ color: overDone ? TOKEN.danger : 'var(--color-text-primary)' }}
        title={overDone ? 'Mai multe piese raportate decât are lista' : undefined}
      >
        {step.progressPct}%
      </span>
      <span className="w-10 shrink-0 text-right text-[10px] tabular-nums text-text-muted">
        {formatHours(step.workedMinutes)}
      </span>
    </li>
  );
}

function ProjectCard({
  row,
  onSelect,
}: {
  row: ActiveProjectRow;
  onSelect: () => void;
}) {
  const tone = gapTone(row.gapPct);
  const gapColor =
    tone === 'bad' ? TOKEN.danger : tone === 'good' ? TOKEN.success : TOKEN.muted;
  const overdue = row.daysToDue !== null && row.daysToDue < 0;

  return (
    <article className="rounded-lg border border-border-subtle bg-surface p-3">
      <header className="flex items-start justify-between gap-2">
        <button
          type="button"
          onClick={onSelect}
          className="min-w-0 text-left"
          aria-label={`Deschide fișa proiectului ${row.label}`}
        >
          <span className="block truncate text-sm font-medium text-text-primary hover:text-accent">
            {row.label}
          </span>
          <span className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[10px] text-text-muted">
            <span
              className={`rounded px-1.5 py-px font-medium ${getProjectStatusBadgeClassName(row.status)}`}
            >
              {getProjectStatusLabel(row.status)}
            </span>
            <span className="font-mono">{row.code}</span>
            <span aria-hidden="true">·</span>
            <span className="truncate">{row.companyName}</span>
          </span>
        </button>

        <span
          className="shrink-0 rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums"
          style={{ backgroundColor: tint(gapColor, '18%'), color: gapColor }}
          title="Ore consumate minus execuție fizică"
        >
          {formatGap(row.gapPct)}
        </span>
      </header>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <LabelledBar
          label="Ore consumate"
          pct={row.hoursPct}
          color={HOURS_COLOR}
          detail={
            row.estimatedMinutes === null
              ? `${formatHours(row.workedMinutes)} · fără estimare`
              : `${formatHours(row.workedMinutes)} din ${formatHours(row.estimatedMinutes)}`
          }
        />
        <LabelledBar
          label="Execuție"
          pct={row.physicalPct}
          color={WORK_COLOR}
          detail={
            row.steps.length === 0
              ? 'fără listă de ansamble'
              : `media a ${row.steps.length} ${row.steps.length === 1 ? 'pas început' : 'pași începuți'}`
          }
        />
      </div>

      {row.steps.length > 0 && (
        <ul className="mt-2 space-y-1 border-t border-border-subtle pt-2">
          {row.steps.map((step, index) => (
            <StepRow key={step.activityId} step={step} index={index} />
          ))}
        </ul>
      )}

      <footer className="mt-2 text-[10px] text-text-muted">
        <span style={overdue ? { color: TOKEN.danger } : undefined}>
          {formatDaysToDue(row.daysToDue)}
        </span>
      </footer>
    </article>
  );
}

export function ActiveProjectsView({
  onSelectProject,
}: {
  onSelectProject: (projectId: string) => void;
}) {
  const [report, setReport] = useState<ActiveProjectsReportResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getActiveProjectsReport());
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport();
  }, [loadReport]);

  if (loading) {
    return <p className="py-8 text-center text-sm text-text-muted">Se încarcă…</p>;
  }

  if (error) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
        <p className="text-sm text-danger">{error}</p>
        <button
          type="button"
          onClick={() => void loadReport()}
          className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
        >
          Reîncearcă
        </button>
      </div>
    );
  }

  const rows = report?.rows ?? [];

  return (
    <div className="space-y-2">
      <SectionCard
        title="Ore consumate vs. execuție"
        hint={`${rows.length} ${rows.length === 1 ? 'proiect' : 'proiecte'}`}
      >
        <p className="text-[11px] leading-relaxed text-text-muted">
          Orele sunt pontajul raportat la estimare. Execuția e media pașilor începuți,
          măsurată în kilograme din lista de ansamble. Diferența pozitivă înseamnă că
          orele merg înaintea lucrului — proiectele cu cea mai mare diferență sunt primele.
        </p>
      </SectionCard>

      {rows.length === 0 ? (
        <SectionCard title="Proiecte active">
          <EmptyHint>
            Niciun proiect activ cu estimare sau listă de ansamble.
          </EmptyHint>
        </SectionCard>
      ) : (
        <div className="grid gap-2 xl:grid-cols-2">
          {rows.map((row) => (
            <ProjectCard
              key={row.id}
              row={row}
              onSelect={() => onSelectProject(row.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
