'use client';

import {
  getProjectReport,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  type AssemblyStepProgress,
  type ProjectReportActivityRow,
  type ProjectReportPersonRow,
  type ProjectReportResponse,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { InitialsAvatar } from '@/components/PersonAvatar';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { Bar, EmptyHint } from './ReportSection';
import { paletteColor, TOKEN, tint } from './reportColors';
import {
  efficiencyTone,
  formatDayLabel,
  formatEfficiency,
  formatExactDuration,
  formatHours,
  formatHoursPerTon,
  formatPct,
  formatTons,
} from './reportsFormat';

function initialsOf(personName: string): string {
  const parts = personName.trim().split(/\s+/);
  const initials = parts
    .slice(0, 2)
    .map((part) => part[0] ?? '')
    .join('')
    .toUpperCase();
  return initials || '?';
}

function Row({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2">
      <div className="truncate text-[11px] leading-tight text-text-muted">{label}</div>
      <div
        className="mt-0.5 text-base font-semibold tabular-nums leading-none"
        style={{ color: tone ?? 'var(--color-text-primary)' }}
      >
        {value}
      </div>
    </div>
  );
}

/** "4,2 t din 9,0 t · 128/300 buc", with the hand-ticked slice named. */
function StepProgressLine({ progress }: { progress: AssemblyStepProgress }) {
  const pct =
    progress.weightTotalKg > 0
      ? Math.round((progress.weightDoneKg / progress.weightTotalKg) * 100)
      : progress.piecesTotal > 0
        ? Math.round((progress.piecesDone / progress.piecesTotal) * 100)
        : null;
  const overDone = pct !== null && pct > 100;

  return (
    <div className="mt-1">
      <Bar pct={pct ?? 0} color={overDone ? TOKEN.danger : TOKEN.success} />
      <p className="mt-1 text-[10px] text-text-muted">
        {progress.weightTotalKg > 0 && (
          <>
            {formatTons(progress.weightDoneKg)} din {formatTons(progress.weightTotalKg)} ·{' '}
          </>
        )}
        {progress.piecesDone}/{progress.piecesTotal} buc · {formatPct(pct)}
        {progress.piecesManual > 0 && <> · {progress.piecesManual} buc bifate manual</>}
      </p>
    </div>
  );
}

function ActivityRow({
  row,
  scale,
  index,
}: {
  row: ProjectReportActivityRow;
  scale: number;
  index: number;
}) {
  const color = row.color ?? paletteColor(index);
  const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;

  return (
    <li className="rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            className="size-2 shrink-0 rounded-full"
            style={{ backgroundColor: color }}
            aria-hidden="true"
          />
          <span className="truncate text-xs text-text-secondary" title={row.activityName}>
            {row.activityName}
          </span>
        </span>
        <span
          className="shrink-0 text-xs font-medium tabular-nums text-text-primary"
          title={formatExactDuration(row.workedMinutes)}
        >
          {formatHours(row.workedMinutes)}
        </span>
      </div>
      <Bar pct={widthPct} color={color} className="mt-1.5" />
      {row.progress && <StepProgressLine progress={row.progress} />}
    </li>
  );
}

function PersonRow({
  row,
  scale,
  activityNames,
}: {
  row: ProjectReportPersonRow;
  scale: number;
  activityNames: Map<string, string>;
}) {
  const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;

  return (
    <li className="rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2">
      <div className="flex items-center gap-2">
        <InitialsAvatar initials={initialsOf(row.personName)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-2">
            <span className="truncate text-xs font-medium text-text-primary">
              {row.personName}
            </span>
            <span
              className="shrink-0 text-xs font-medium tabular-nums text-text-primary"
              title={formatExactDuration(row.workedMinutes)}
            >
              {formatHours(row.workedMinutes)}
            </span>
          </div>
          <span className="block truncate text-[10px] text-text-muted">
            {row.roleName ?? 'Fără rol'}
          </span>
        </div>
      </div>

      <Bar pct={widthPct} color={TOKEN.accent} className="mt-1.5" />

      <div className="mt-1.5 flex flex-wrap gap-1">
        {row.byActivity.map((cell) => (
          <span
            key={cell.activityId ?? 'none'}
            className="rounded px-1.5 py-px text-[10px] text-text-secondary"
            style={{ backgroundColor: tint(TOKEN.muted, '14%') }}
          >
            {activityNames.get(cell.activityId ?? '') ?? 'Activitate'}{' '}
            <span className="font-medium tabular-nums">{formatHours(cell.minutes)}</span>
          </span>
        ))}
      </div>
    </li>
  );
}

function ReportBody({ report }: { report: ProjectReportResponse }) {
  const { project, totals } = report;
  const tone = efficiencyTone(totals.efficiencyPct);
  const efficiencyColor =
    tone === 'good' ? TOKEN.success : tone === 'bad' ? TOKEN.danger : TOKEN.muted;

  const activityScale = report.byActivity.reduce(
    (max, row) => Math.max(max, row.workedMinutes),
    0,
  );
  const personScale = report.byPerson.reduce(
    (max, row) => Math.max(max, row.workedMinutes),
    0,
  );
  const activityNames = new Map(
    report.byActivity.map((row) => [row.activityId ?? '', row.activityName]),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-text-muted">
        <span
          className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${getProjectStatusBadgeClassName(project.status)}`}
        >
          {getProjectStatusLabel(project.status)}
        </span>
        <span className="font-mono">{project.code}</span>
        <span aria-hidden="true">·</span>
        <span className="truncate">{project.companyName}</span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <Row label="Ore lucrate" value={formatHours(totals.workedMinutes)} />
        <Row
          label="Estimat"
          value={totals.estimatedMinutes === null ? '—' : formatHours(totals.estimatedMinutes)}
        />
        <Row
          label="Eficiență"
          value={formatEfficiency(totals.efficiencyPct)}
          tone={efficiencyColor}
        />
        <Row label="Greutate" value={formatTons(project.weightKg)} />
        <Row label="Consum" value={formatHoursPerTon(totals.hoursPerTon)} />
        <Row label="Oameni" value={String(totals.peopleCount)} />
      </div>

      <p className="text-[11px] text-text-muted">
        Pontat între {formatDayLabel(totals.firstWorkDay)} și{' '}
        {formatDayLabel(totals.lastWorkDay)}.
      </p>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Pe activitate
        </h3>
        {report.byActivity.length === 0 ? (
          <EmptyHint>Fără ore pontate pe acest proiect.</EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {report.byActivity.map((row, index) => (
              <ActivityRow
                key={row.activityId ?? 'none'}
                row={row}
                scale={activityScale}
                index={index}
              />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Pe om
        </h3>
        {report.byPerson.length === 0 ? (
          <EmptyHint>Nimeni nu a pontat pe acest proiect.</EmptyHint>
        ) : (
          <ul className="space-y-1.5">
            {report.byPerson.map((row) => (
              <PersonRow
                key={row.personId}
                row={row}
                scale={personScale}
                activityNames={activityNames}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

export type ProjectReportPanelProps = {
  projectId: string | null;
  onClose: () => void;
};

/** Fișa proiectului — one project read across its activities and its people. */
export function ProjectReportPanel({ projectId, onClose }: ProjectReportPanelProps) {
  const [report, setReport] = useState<ProjectReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    // Drop the previous project's figures: the panel keeps its title and its
    // numbers on screen while loading, and they would belong to another job.
    setReport(null);
    try {
      setReport(await getProjectReport(id));
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!projectId) {
      setReport(null);
      setError(null);
      return;
    }
    void loadReport(projectId);
  }, [loadReport, projectId]);

  return (
    <SlideOverPanel
      open={projectId !== null}
      title={report?.project.label ?? 'Fișa proiectului'}
      onClose={onClose}
      widthClassName="max-w-2xl"
    >
      {loading && <p className="py-8 text-center text-sm text-text-muted">Se încarcă…</p>}

      {!loading && error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => projectId && void loadReport(projectId)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {!loading && !error && report && <ReportBody report={report} />}
    </SlideOverPanel>
  );
}
