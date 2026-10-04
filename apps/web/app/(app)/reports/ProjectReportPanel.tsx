'use client';

import {
  getProjectReport,
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  type AssemblyStepProgress,
  type Period,
  type ProjectReportActivityRow,
  type ProjectReportPersonRow,
  type ProjectReportResponse,
} from '@fabxpert/shared';
import Link, { useLinkStatus } from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import { InitialsAvatar } from '@/components/PersonAvatar';
import { AssemblyIcon } from '@/components/AssemblyIcon';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  allTimePeriod,
  buildActivityTimesheetListHref,
  buildTimesheetListHref,
} from '@/utils/timesheetListNavigation';
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

/** Label column of an activity's bars; the two rows share it so the bars line up. */
const BAR_LABEL_CLASS = 'whitespace-nowrap text-[10px] text-text-muted';

/**
 * The progress bar's colour: the activity's own, pulled towards the text
 * colour — close enough to read as the same activity, different enough not to
 * pass for the hours bar above it.
 */
function progressColor(activityColor: string): string {
  return `color-mix(in srgb, ${activityColor} 62%, var(--color-text-primary))`;
}

/**
 * Second row of an activity: how far its assembly list has got, with the
 * figures on the same line as the bar — tonnes, pieces, percent.
 */
function StepProgressCells({
  progress,
  color,
}: {
  progress: AssemblyStepProgress;
  /** The activity's colour. */
  color: string;
}) {
  const pct =
    progress.weightTotalKg > 0
      ? Math.round((progress.weightDoneKg / progress.weightTotalKg) * 100)
      : progress.piecesTotal > 0
        ? Math.round((progress.piecesDone / progress.piecesTotal) * 100)
        : null;
  const overDone = pct !== null && pct > 100;

  return (
    <>
      <span className={BAR_LABEL_CLASS}>Progres pe ansamble</span>
      {/* More reported than the list holds still reads as a problem, whatever the activity. */}
      <Bar pct={pct ?? 0} color={overDone ? TOKEN.danger : progressColor(color)} />
      <span className="col-span-2 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] tabular-nums text-text-muted sm:col-span-1 sm:justify-end">
        {progress.weightTotalKg > 0 && (
          <span className="inline-flex items-center gap-1">
            <i className="ti ti-weight text-xs" aria-hidden="true" />
            {formatTons(progress.weightDoneKg)} din {formatTons(progress.weightTotalKg)}
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <AssemblyIcon className="text-xs" />
          {progress.piecesDone} / {progress.piecesTotal} buc
        </span>
        <span className="font-medium text-text-primary">{formatPct(pct)}</span>
        {progress.piecesManual > 0 && <span>{progress.piecesManual} buc bifate manual</span>}
      </span>
    </>
  );
}

const ROW_CARD_CLASS = 'rounded-md border border-border-subtle bg-surface-raised/30 px-2.5 py-2';
const ROW_LINK_CLASS =
  'transition-colors hover:border-accent/40 hover:bg-surface-raised focus:outline-none focus:ring-1 focus:ring-accent';

function ActivityRow({
  row,
  scale,
  index,
  timesheetsHref,
}: {
  row: ProjectReportActivityRow;
  scale: number;
  index: number;
  /** The pontaje behind this row: this activity on this project; null for hours without an activity. */
  timesheetsHref: string | null;
}) {
  const color = row.color ?? paletteColor(index);
  const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;

  const content = (
    <>
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
        <span className="flex shrink-0 items-center gap-1.5">
          {timesheetsHref && <OpeningSpinner />}
          <span
            className="inline-flex items-center gap-1 text-xs font-medium tabular-nums text-text-primary"
            title={formatExactDuration(row.workedMinutes)}
          >
            <i className="ti ti-clock text-xs text-text-muted" aria-hidden="true" />
            {formatHours(row.workedMinutes)}
          </span>
        </span>
      </div>
      {/* Label | bar | figures. One grid for both rows, so the bars start and
          end together; on a phone the figures drop under their bar. */}
      <div className="mt-1.5 grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2.5 gap-y-1.5 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
        <span className={BAR_LABEL_CLASS}>Ore logate</span>
        <Bar pct={widthPct} color={color} />
        <span className="hidden sm:block" aria-hidden="true" />
        {row.progress && <StepProgressCells progress={row.progress} color={color} />}
      </div>
    </>
  );

  if (!timesheetsHref) {
    return <li className={ROW_CARD_CLASS}>{content}</li>;
  }

  return (
    <li>
      <Link
        href={timesheetsHref}
        aria-label={`Deschide pontajele pe ${row.activityName} pentru acest proiect`}
        className={`block ${ROW_CARD_CLASS} ${ROW_LINK_CLASS}`}
      >
        {content}
      </Link>
    </li>
  );
}

/**
 * Spins on the row being opened. The delay keeps it from flashing when the
 * page is already prefetched and opens at once.
 */
function OpeningSpinner() {
  const { pending } = useLinkStatus();
  return (
    <i
      className={`ti ti-loader-2 animate-spin text-xs text-text-muted transition-opacity ${
        pending ? 'opacity-100 delay-150' : 'opacity-0'
      }`}
      aria-hidden="true"
    />
  );
}

function PersonRow({
  row,
  scale,
  activityNames,
  timesheetsHref,
}: {
  row: ProjectReportPersonRow;
  scale: number;
  activityNames: Map<string, string>;
  /** The pontaje behind this row: this person, this project, the report's dates. */
  timesheetsHref: string;
}) {
  const widthPct = scale > 0 ? (row.workedMinutes / scale) * 100 : 0;

  return (
    <li>
      <Link
        href={timesheetsHref}
        aria-label={`Deschide pontajele pentru ${row.personName} pe acest proiect`}
        className={`block ${ROW_CARD_CLASS} ${ROW_LINK_CLASS}`}
      >
        <div className="flex items-center gap-2">
          <InitialsAvatar initials={initialsOf(row.personName)} />
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs font-medium text-text-primary">
                {row.personName}
              </span>
              <span className="flex shrink-0 items-center gap-1.5">
                <OpeningSpinner />
                <span
                  className="text-xs font-medium tabular-nums text-text-primary"
                  title={formatExactDuration(row.workedMinutes)}
                >
                  {formatHours(row.workedMinutes)}
                </span>
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
      </Link>
    </li>
  );
}

function ReportBody({ report }: { report: ProjectReportResponse }) {
  const { project, totals } = report;
  // Where "Înapoi" on the pontaje leads: this page, whose address reopens this
  // report (every page showing it keeps it there).
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const returnTo = search ? `${pathname}?${search}` : pathname;
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
  // The report covers the project's whole life, so the list opens on it too.
  const reportPeriod: Period =
    totals.firstWorkDay && totals.lastWorkDay
      ? { kind: 'custom', from: totals.firstWorkDay, to: totals.lastWorkDay }
      : allTimePeriod();
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
                timesheetsHref={
                  row.activityId
                    ? buildActivityTimesheetListHref({
                        projectId: project.id,
                        activityId: row.activityId,
                        period: reportPeriod,
                        returnTo,
                      })
                    : null
                }
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
                timesheetsHref={buildTimesheetListHref({
                  personId: row.personId,
                  projectId: project.id,
                  from: totals.firstWorkDay,
                  to: totals.lastWorkDay,
                  returnTo,
                })}
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
  /** Called each time a project's fișa arrives. */
  onLoaded?: (report: ProjectReportResponse) => void;
};

/** Fișa proiectului — one project read across its activities and its people. */
export function ProjectReportPanel({ projectId, onClose, onLoaded }: ProjectReportPanelProps) {
  const [report, setReport] = useState<ProjectReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Read through a ref so a new callback from the parent doesn't reload the fișa.
  const onLoadedRef = useRef(onLoaded);
  onLoadedRef.current = onLoaded;

  const loadReport = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    // Drop the previous project's figures: the panel keeps its title and its
    // numbers on screen while loading, and they would belong to another job.
    setReport(null);
    try {
      const loaded = await getProjectReport(id);
      setReport(loaded);
      onLoadedRef.current?.(loaded);
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
