'use client';

import { formatProjectDueDate, type PinnedProjectSummaryRow } from '@fabxpert/shared';
import type { ReactNode } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { AssemblyIcon } from '@/components/AssemblyIcon';
import { FinisajBadge } from '@/components/FinisajBadge';
import { ProjectComplexityBadge } from '@/components/ProjectComplexityBadge';
import { ProjectTasksLink } from '@/components/ProjectTasksLink';
import { formatProjectWeight } from '@/utils/projectWeight';
import { formatProjectWeldLength } from '@/utils/projectWeldLength';
import { ProjectProgressCell } from '../projects/ProjectProgressCell';
import { formatProjectTimelineRange, getProjectDaysRemainingLabel } from './panouProjectTimeline';
import { ProjectVisibleForCompact } from './panouProjectVisibility';

/** "30 sep 2026" — the card has room for the year. */
function formatDate(value: string): string {
  return new Date(value)
    .toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .trim();
}

/**
 * A figure to print. Checked rather than compared with null: a summary from an
 * API that predates the field leaves it undefined, and the formatters would
 * turn that into "NaN".
 */
function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function Empty() {
  return <span className="text-text-muted">—</span>;
}

/** An icon beside a caption and its value, the pair aligned on the caption. */
function Cell({
  icon,
  label,
  children,
  className = '',
}: {
  icon: ReactNode;
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-start gap-1.5 ${className}`}>
      <span
        className="mt-px inline-flex w-5 shrink-0 justify-center text-base text-text-muted"
        aria-hidden="true"
      >
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <div className="panou-detail-label truncate text-[11px] text-text-muted">{label}</div>
        <div className="panou-detail-value mt-0.5 flex h-6 min-w-0 items-center text-[13px] text-text-primary">
          {children}
        </div>
      </div>
    </div>
  );
}

function Icon({ name }: { name: string }) {
  return <i className={`ti ${name}`} />;
}

/**
 * Thin rules between the groups once the card is wide enough for one line;
 * narrower, the groups wrap into a grid. Sized on the card, not the screen, so
 * the one- and two-column panou layouts both read well.
 */
const RULES =
  '@xl:gap-x-0 @xl:[&>*+*]:border-l @xl:[&>*+*]:border-border-subtle @xl:[&>*]:px-2.5 @xl:[&>*:first-child]:pl-0';

/**
 * The deadline the way the old card footer showed it: how far it is, coloured
 * (late in red), over the start–due range. Never cut short — the column takes
 * the room the text needs ("Întârziat cu 100 zile").
 */
function DeadlineCell({
  startDate,
  dueDate,
}: {
  startDate: string | null;
  dueDate: string | null;
}) {
  if (!dueDate) {
    return (
      <div className="flex min-w-0 items-center gap-1.5 self-end" title="Termen limită">
        <span
          className="inline-flex w-5 shrink-0 justify-center text-base text-text-muted"
          aria-hidden="true"
        >
          <Icon name="ti-calendar" />
        </span>
        <span className="panou-detail-value flex h-6 items-center text-[13px]">
          <Empty />
        </span>
      </div>
    );
  }

  const days = getProjectDaysRemainingLabel(dueDate);
  const range = startDate
    ? formatProjectTimelineRange(startDate, dueDate)
    : `Termen ${formatProjectDueDate(dueDate)}`;

  return (
    <div className="min-w-0 whitespace-nowrap" title={`Termen: ${formatDate(dueDate)}`}>
      <div
        className={`panou-detail-value flex h-6 items-center gap-1.5 text-[13px] ${days.className}`}
      >
        <i className="ti ti-calendar text-base" aria-hidden="true" />
        {days.text}
      </div>
      <div className="panou-detail-label mt-0.5 pl-[22px] text-[11px] tabular-nums text-text-muted">
        {range}
      </div>
    </div>
  );
}

/**
 * The two rows under a pinned card's header: the production figures and the
 * deadline, then assemblies, roles and tasks with the progress and the expand
 * toggle at the far right. Finish
 * and client stay in the header, so nothing here repeats them.
 */
export function PinnedProjectDetails({
  project,
  expanded,
  onToggle,
  onOpenAssemblies,
}: {
  project: PinnedProjectSummaryRow;
  expanded: boolean;
  onToggle: () => void;
  onOpenAssemblies: () => void;
}) {
  return (
    <div className="panou-card-details @container mt-2.5">
      <div
        className={`grid grid-cols-2 gap-x-4 gap-y-3 border-t border-border-subtle py-2.5 @md:grid-cols-3 @xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_max-content] ${RULES}`}
      >
        {/* On phones the finish moves up under the client (PinnedProjectCard). */}
        <Cell icon={<Icon name="ti-paint" />} label="Finisaj" className="max-md:hidden">
          {project.finisaj ? (
            <span className="flex min-w-0 items-center overflow-hidden" title={project.finisaj}>
              <FinisajBadge value={project.finisaj} />
            </span>
          ) : (
            <Empty />
          )}
        </Cell>
        <Cell icon={<Icon name="ti-weight" />} label="Greutate">
          {!isFiniteNumber(project.weight) ? (
            <Empty />
          ) : (
            <span className="tabular-nums">{formatProjectWeight(project.weight)}</span>
          )}
        </Cell>
        <Cell icon={<Icon name="ti-stack-2" />} label="Complexitate">
          {!isFiniteNumber(project.piecesPerTon) ? (
            <Empty />
          ) : (
            <ProjectComplexityBadge piecesPerTon={project.piecesPerTon} showValue />
          )}
        </Cell>
        <Cell icon={<Icon name="ti-ruler-measure" />} label="Sudură">
          {!isFiniteNumber(project.weldLengthMeters) ? (
            <Empty />
          ) : (
            <span className="tabular-nums">
              {formatProjectWeldLength(project.weldLengthMeters)}
            </span>
          )}
        </Cell>
        <DeadlineCell startDate={project.startDate} dueDate={project.dueDate} />
      </div>

      <div className="flex items-center gap-3 border-t border-border-subtle pt-2.5">
        <div
          className={`grid min-w-0 flex-1 grid-cols-3 gap-x-3 gap-y-3 max-md:grid-cols-2 @xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,0.8fr)_minmax(0,1.8fr)] ${RULES}`}
        >
          {/* The icon opens the list window too — view, edit, add — even
              before a list exists, so one can be started from here. */}
          <div className="flex min-w-0 items-start gap-1.5">
            <button
              type="button"
              onClick={onOpenAssemblies}
              aria-label={
                project.assemblyCount === 0
                  ? 'Deschide lista de ansamble'
                  : `Vezi cele ${project.assemblyCount} ansamble`
              }
              title={
                project.assemblyCount === 0
                  ? 'Deschide lista de ansamble'
                  : `Vezi cele ${project.assemblyCount} ansamble`
              }
              className="-m-0.5 inline-flex w-6 shrink-0 justify-center rounded p-0.5 text-base text-text-muted transition-colors hover:bg-surface-raised hover:text-accent"
            >
              <AssemblyIcon />
            </button>
            <div className="min-w-0 flex-1">
              <div className="panou-detail-label truncate text-[11px] text-text-muted">Ansamble</div>
              <div className="panou-detail-value mt-0.5 flex h-6 min-w-0 items-center text-[13px] text-text-primary">
                {project.assemblyCount === 0 ? (
                  <Empty />
                ) : (
                  <button
                    type="button"
                    onClick={onOpenAssemblies}
                    title={`Vezi cele ${project.assemblyCount} ansamble`}
                    className="-mx-1 truncate rounded px-1 transition-colors hover:bg-surface-raised hover:text-accent"
                  >
                    {project.assemblyCount} {project.assemblyCount === 1 ? 'ansamblu' : 'ansamble'}
                  </button>
                )}
              </div>
            </div>
          </div>
          {/* No caption: the eye says it. It sits where the other icons do and
              the chip on the values' line, so the row reads level. */}
          <div className="flex min-w-0 items-start gap-1.5 max-md:hidden" title="Vizibil pentru">
            <span
              className="mt-px inline-flex w-5 shrink-0 justify-center text-base text-text-muted"
              aria-hidden="true"
            >
              <Icon name="ti-eye" />
            </span>
            <div className="min-w-0 flex-1">
              <div className="panou-detail-label text-[11px]">
                <span className="sr-only">Vizibil pentru</span>
                <span aria-hidden="true">&nbsp;</span>
              </div>
              <div className="panou-detail-value mt-0.5 flex h-6 min-w-0 items-center">
                <ProjectVisibleForCompact
                  roles={project.visibleForRoles}
                  readyForExecution={project.readyForExecution}
                />
              </div>
            </div>
          </div>
          <Cell icon={<Icon name="ti-list-check" />} label="Task-uri">
            <ProjectTasksLink projectId={project.id} variant="cell" hideIcon />
          </Cell>
          {/* Narrow cards: assemblies, roles and tasks share one line, and
              progress gets the next to itself, starting where the captions do,
              clear of the drag handle in the corner. */}
          <div className="col-span-3 min-w-0 pl-[26px] max-md:col-span-2 @xl:col-span-1 @xl:pl-2.5">
            <div className="panou-detail-label text-[11px] text-text-muted">Progres</div>
            <div className="panou-detail-value mt-0.5 flex h-6 min-w-0 items-center text-[13px]">
              {project.progressPercent !== null ? (
                <span className="w-full">
                  <ProjectProgressCell progressPercent={project.progressPercent} />
                </span>
              ) : (
                // Without a list there is no progress; the hours are the next best figure.
                <span className="tabular-nums text-text-secondary">
                  {formatDurationMinutes(project.totalMinutes)} logate
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-label={expanded ? 'Restrânge detaliile' : 'Extinde detaliile'}
          title={expanded ? 'Restrânge detaliile' : 'Extinde detaliile'}
          className="flex size-9 shrink-0 items-center justify-center rounded-md border border-border-subtle text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
        >
          <i
            className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-base`}
            aria-hidden="true"
          />
        </button>
      </div>
    </div>
  );
}
