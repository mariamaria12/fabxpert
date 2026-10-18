'use client';

import {
  getProjectStatusBadgeClassName,
  getProjectStatusLabel,
  isProjectDueDateOverdue,
  parseFinisaj,
  splitFinisaj,
  type ProjectDto,
} from '@fabxpert/shared';
import { useState, type ReactNode } from 'react';
import { AssemblyIcon } from '@/components/AssemblyIcon';
import { FinisajBadge } from '@/components/FinisajBadge';
import { ProjectComplexityBadge } from '@/components/ProjectComplexityBadge';
import { ProjectTasksLink } from '@/components/ProjectTasksLink';
import { formatProjectEstimatedHours } from '@/utils/projectEstimatedHours';
import { formatProjectWeight } from '@/utils/projectWeight';
import { formatProjectWeldLength } from '@/utils/projectWeldLength';
import { ProjectVisibleForCell } from '../panou/panouProjectVisibility';
import { ProjectAssemblyCountCell } from './ProjectAssemblyCountCell';
import { ProjectProgressCell } from './ProjectProgressCell';

const SKELETON_ROWS = 4;

interface ProjectDetailsListProps {
  projects: ProjectDto[];
  loading: boolean;
  /** Buttons at the top right of each row (pin, fișa, pencil). */
  renderActions: (project: ProjectDto) => ReactNode;
  /** Given, each row gets a chevron that opens this below it. */
  renderExpanded?: (project: ProjectDto) => ReactNode;
  /** Rows open on arrival, e.g. the project Back returned to. */
  defaultExpandedIds?: string[];
}

/** "20 iun 2026" — the long form, since this view has the room for the year. */
function formatDate(value: string): string {
  return new Date(value)
    .toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' })
    .replace(/\./g, '')
    .trim();
}

function Empty() {
  return <span className="text-text-muted">—</span>;
}

/** One labelled value: a small icon and caption over the figure. */
function Field({
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
    <div className={`min-w-0 ${className}`}>
      <div className="flex items-center gap-1.5 text-xs text-text-muted">
        <span className="inline-flex w-4 shrink-0 justify-center text-sm" aria-hidden="true">
          {icon}
        </span>
        {label}
      </div>
      <div className="mt-1 flex h-7 min-w-0 items-center pl-[22px] text-sm text-text-primary">
        {children}
      </div>
    </div>
  );
}

function TablerIcon({ name }: { name: string }) {
  return <i className={`ti ${name}`} />;
}

/**
 * Splits the finish the way the shop reads it: the treatment ("Zincare",
 * "Grund AL") apart from the paint colours, which keep their RAL badges.
 */
function splitFinishAndColours(finisaj: string | null): {
  treatments: string[];
  colours: string[];
} {
  const treatments: string[] = [];
  const colours: string[] = [];
  for (const segment of splitFinisaj(finisaj)) {
    const parsed = parseFinisaj(segment);
    if (!parsed) {
      continue;
    }
    if (parsed.kind === 'ral') {
      colours.push(segment);
    } else {
      treatments.push(parsed.label);
    }
  }
  return { treatments, colours };
}

/**
 * Same fixed height in both blocks, so their fields line up row for row even
 * when the action buttons sit beside one of the titles.
 */
function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <h4 className="mb-3 flex h-5 items-center text-xs font-semibold text-text-secondary">
      {children}
    </h4>
  );
}

function ProjectDetailsRow({
  project,
  actions,
  expanded,
  onToggleExpanded,
  expandedContent,
}: {
  project: ProjectDto;
  actions: ReactNode;
  expanded: boolean;
  onToggleExpanded?: () => void;
  expandedContent?: ReactNode;
}) {
  const { treatments, colours } = splitFinishAndColours(project.finisaj);
  const overdue = project.dueDate
    ? isProjectDueDateOverdue(project.dueDate, project.status)
    : false;

  return (
    <li className="overflow-hidden rounded-lg border border-border-subtle bg-surface">
      <div className="flex">
        <span
          className="w-1 shrink-0"
          style={{ backgroundColor: project.color ?? 'var(--color-border-subtle)' }}
          aria-hidden="true"
        />
        <div className="grid min-w-0 flex-1 gap-5 p-4 lg:grid-cols-[minmax(200px,1.1fr)_minmax(0,2fr)_minmax(0,1.6fr)] lg:gap-0">
          <div className="flex min-w-0 items-start justify-between gap-3 lg:pr-5">
            <div className="min-w-0">
              <p className="truncate text-xs text-text-muted" title={project.code}>
                {project.code}
              </p>
              <p
                className="mt-1 line-clamp-2 text-base font-medium text-text-primary"
                title={project.name}
              >
                {project.denumireLucrare ?? project.name}
              </p>
              <p className="mt-1 truncate text-sm text-text-secondary" title={project.company.name}>
                {project.company.name}
              </p>
            </div>
            <span
              className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${getProjectStatusBadgeClassName(project.status)}`}
            >
              {getProjectStatusLabel(project.status)}
            </span>
          </div>

          <section className="min-w-0 border-border-subtle lg:border-l lg:px-5">
            <SectionTitle>Producție</SectionTitle>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">
              <Field
                icon={<TablerIcon name="ti-chart-bar" />}
                label="Progres"
                className="col-span-2"
              >
                <span className="w-full max-w-56">
                  <ProjectProgressCell progressPercent={project.progressPercent} />
                </span>
              </Field>
              <Field icon={<TablerIcon name="ti-ruler-measure" />} label="Sudură">
                {project.weldLengthMeters === null ? (
                  <Empty />
                ) : (
                  <span className="tabular-nums">
                    {formatProjectWeldLength(project.weldLengthMeters)}
                  </span>
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-clock" />} label="Ore estimate">
                {project.estimatedHours === null ? (
                  <Empty />
                ) : (
                  <span className="tabular-nums">
                    {formatProjectEstimatedHours(project.estimatedHours)}
                  </span>
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-weight" />} label="Greutate">
                {project.weight === null ? (
                  <Empty />
                ) : (
                  <span className="tabular-nums">{formatProjectWeight(project.weight)}</span>
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-stack-2" />} label="Complexitate">
                {project.piecesPerTon === null ? (
                  <Empty />
                ) : (
                  <ProjectComplexityBadge piecesPerTon={project.piecesPerTon} showValue />
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-paint" />} label="Finisaj">
                {treatments.length === 0 ? (
                  <Empty />
                ) : (
                  <span className="truncate" title={treatments.join(', ')}>
                    {treatments.join(', ')}
                  </span>
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-droplet" />} label="Culoare">
                {colours.length === 0 ? (
                  <Empty />
                ) : (
                  <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                    {colours.map((colour, index) => (
                      <FinisajBadge key={`${colour}-${index}`} value={colour} />
                    ))}
                  </span>
                )}
              </Field>
            </div>
          </section>

          <section className="min-w-0 border-border-subtle lg:border-l lg:pl-5">
            <div className="flex items-center justify-between gap-3">
              <SectionTitle>Planificare</SectionTitle>
              {/* Taller than the title; kept out of the flow height so the fields stay aligned. */}
              <div className="mb-3 flex h-5 shrink-0 items-center gap-1">
                {actions}
                {onToggleExpanded && (
                  <button
                    type="button"
                    aria-expanded={expanded}
                    aria-label={expanded ? 'Ascunde defalcarea' : 'Afișează defalcarea'}
                    title={expanded ? 'Ascunde defalcarea' : 'Afișează defalcarea'}
                    onClick={onToggleExpanded}
                    className="rounded p-1.5 text-text-muted transition-all hover:bg-surface-raised hover:text-text-primary"
                  >
                    <i
                      className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-base`}
                      aria-hidden="true"
                    />
                  </button>
                )}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field icon={<TablerIcon name="ti-calendar" />} label="Început">
                {project.startDate ? (
                  <span className="tabular-nums">{formatDate(project.startDate)}</span>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-flag" />} label="Termen">
                {project.dueDate ? (
                  <span className={`tabular-nums ${overdue ? 'text-danger' : ''}`}>
                    {formatDate(project.dueDate)}
                  </span>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-eye" />} label="Vizibil pentru">
                <ProjectVisibleForCell
                  roles={project.visibleForRoles}
                  readyForExecution={project.readyForExecution}
                />
              </Field>
              <Field icon={<AssemblyIcon />} label="Ansamble">
                <ProjectAssemblyCountCell project={project} />
              </Field>
              <Field icon={<TablerIcon name="ti-player-play" />} label="Gata de exec.">
                {project.readyForExecution ? (
                  <span className="inline-flex items-center gap-1 text-success">
                    <i className="ti ti-check text-base" aria-hidden="true" />
                    Da
                  </span>
                ) : (
                  <Empty />
                )}
              </Field>
              <Field icon={<TablerIcon name="ti-list-check" />} label="Task-uri">
                <ProjectTasksLink projectId={project.id} variant="cell" hideIcon />
              </Field>
            </div>
          </section>
        </div>
      </div>
      {expanded && expandedContent ? (
        <div className="border-t border-border-subtle">{expandedContent}</div>
      ) : null}
    </li>
  );
}

function ProjectDetailsSkeleton() {
  return (
    <ul className="flex flex-col gap-3" aria-busy="true" aria-label="Se încarcă proiectele">
      {Array.from({ length: SKELETON_ROWS }, (_, index) => (
        <li
          key={index}
          className="flex h-36 gap-4 rounded-lg border border-border-subtle bg-surface p-4"
        >
          <div className="flex w-1/4 flex-col gap-2">
            <div className="h-3 w-16 animate-pulse rounded bg-surface-raised" />
            <div className="h-4 w-3/4 animate-pulse rounded bg-surface-raised" />
            <div className="h-3 w-1/2 animate-pulse rounded bg-surface-raised" />
          </div>
          <div className="hidden flex-1 flex-col gap-3 sm:flex">
            <div className="h-3 w-1/3 animate-pulse rounded bg-surface-raised" />
            <div className="h-3 w-2/3 animate-pulse rounded bg-surface-raised" />
          </div>
        </li>
      ))}
    </ul>
  );
}

/**
 * Every project field at once, a row per project in two blocks — production
 * and planning. The other view of the projects tables, for reading rather
 * than sorting.
 */
export function ProjectDetailsList({
  projects,
  loading,
  renderActions,
  renderExpanded,
  defaultExpandedIds,
}: ProjectDetailsListProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(
    () => new Set(defaultExpandedIds ?? []),
  );

  if (loading) {
    return <ProjectDetailsSkeleton />;
  }

  function toggle(projectId: string) {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }

  return (
    <ul className="flex flex-col gap-3">
      {projects.map((project) => (
        <ProjectDetailsRow
          key={project.id}
          project={project}
          actions={renderActions(project)}
          expanded={expandedIds.has(project.id)}
          onToggleExpanded={renderExpanded ? () => toggle(project.id) : undefined}
          expandedContent={
            renderExpanded && expandedIds.has(project.id) ? renderExpanded(project) : undefined
          }
        />
      ))}
    </ul>
  );
}
