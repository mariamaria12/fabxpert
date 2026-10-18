'use client';

import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';
import { updateProject } from '@fabxpert/shared';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { AssemblyIcon } from '@/components/AssemblyIcon';
import { FinisajBadge } from '@/components/FinisajBadge';
import { AssemblyListScreen } from '@/app/(app)/projects/AssemblyListScreen';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import type { PanouReturnPoint } from './panouReturnPoint';
import { allTimePeriod } from '@/utils/timesheetListNavigation';
import { taskHref } from '@/utils/taskNavigation';
import { NEUTRAL_ACCENT, panouAccentTint } from './panouColors';
import { PanouProjectCard } from './PanouProjectCard';
import { PinnedProjectDetails } from './PinnedProjectDetails';
import { pinToggleToastMessage } from './ProjectPinButton';
import type { DraggableAttributes } from '@dnd-kit/core';
import type { SyntheticListenerMap } from '@dnd-kit/core/dist/hooks/utilities';

export type DragHandleProps = {
  attributes: DraggableAttributes;
  listeners: SyntheticListenerMap | undefined;
};

function PinnedProjectPinButton({
  project,
  onUnpinned,
}: {
  project: Pick<PinnedProjectSummaryRow, 'id' | 'color' | 'readyForExecution'>;
  onUnpinned: (updated: ProjectDto) => void;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);
  const color = project.color ?? NEUTRAL_ACCENT;

  async function handleClick() {
    if (pending) {
      return;
    }

    setPending(true);
    try {
      const updated = await updateProject(project.id, { isPinned: false });
      onUnpinned(updated);
      showToast(pinToggleToastMessage(updated, project.readyForExecution), 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleClick()}
      disabled={pending}
      aria-label="Anulează fixarea"
      aria-pressed={true}
      className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-md transition-opacity hover:opacity-80 disabled:opacity-50"
      style={{
        backgroundColor: panouAccentTint(project.color, '24%'),
        color,
      }}
    >
      <i className="ti ti-pinned text-base" aria-hidden="true" />
    </button>
  );
}

/** Opens the project's fișa (the report Rapoarte shows), under the edit pencil. */
function PinnedProjectReportButton({ onOpen }: { onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
      aria-label="Rapoarte"
      title="Rapoarte"
      className="flex size-7 shrink-0 items-center justify-center rounded-md border border-border-subtle text-text-muted transition-colors hover:bg-surface-raised hover:text-accent"
    >
      <i className="ti ti-chart-bar text-base leading-none" aria-hidden="true" />
    </button>
  );
}

/** The rarer actions, kept off the card face: the assembly list and the tasks. */
function PinnedProjectMoreMenu({
  projectId,
  assemblyCount,
  onOpenAssemblies,
}: {
  projectId: string;
  assemblyCount: number;
  onOpenAssemblies: () => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  const itemClass =
    'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-text-primary hover:bg-[var(--color-surface-popover-hover)]';

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Mai multe acțiuni"
        title="Mai multe acțiuni"
        onClick={(event) => {
          event.stopPropagation();
          setOpen((current) => !current);
        }}
        className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
      >
        <i className="ti ti-dots text-sm" aria-hidden="true" />
      </button>
      {open && (
        <div
          role="menu"
          className="absolute right-0 top-full z-30 mt-1 w-52 rounded-lg border border-border bg-surface-popover py-1 shadow-popover"
        >
          {assemblyCount > 0 && (
            <button
              type="button"
              role="menuitem"
              className={itemClass}
              onClick={() => {
                setOpen(false);
                onOpenAssemblies();
              }}
            >
              <AssemblyIcon className="text-base text-text-muted" />
              Vezi ansamblele
            </button>
          )}
          <Link
            role="menuitem"
            href={taskHref({ projectId, returnAfter: true })}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <i className="ti ti-list-check text-base text-text-muted" aria-hidden="true" />
            Task-urile proiectului
          </Link>
          <Link
            role="menuitem"
            href={taskHref({ projectId, create: true, returnAfter: true })}
            className={itemClass}
            onClick={() => setOpen(false)}
          >
            <i className="ti ti-plus text-base text-text-muted" aria-hidden="true" />
            Task nou pe proiect
          </Link>
        </div>
      )}
    </div>
  );
}

function PinnedProjectEditButton({ onEdit }: { onEdit: () => void }) {
  return (
    <button
      type="button"
      onClick={(event) => {
        event.stopPropagation();
        onEdit();
      }}
      aria-label="Editează proiectul"
      className="flex size-6 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-surface-raised hover:text-text-secondary"
    >
      <i className="ti ti-pencil text-sm" aria-hidden="true" />
    </button>
  );
}

export function PinnedProjectCard({
  project,
  expanded,
  onToggle,
  onUnpinned,
  onEdit,
  onOpenReport,
  onAssembliesChanged,
  dragHandleProps,
  showPinButton = true,
  titleHandleProps,
  returnPoint,
}: {
  project: PinnedProjectSummaryRow;
  expanded: boolean;
  onToggle: () => void;
  onUnpinned: (updated: ProjectDto) => void;
  onEdit: () => void;
  onOpenReport: () => void;
  /** The list was edited from the card; the summary's counts have to catch up. */
  onAssembliesChanged?: () => void;
  dragHandleProps?: DragHandleProps;
  /** Off on phones, where the card has no icons. */
  showPinButton?: boolean;
  /** Phones drag by holding the project code instead of a grip icon. */
  titleHandleProps?: Record<string, unknown>;
  /** Where Back from the pontaje returns; the pinned section's own card by default. */
  returnPoint?: PanouReturnPoint;
}) {
  const [assembliesOpen, setAssembliesOpen] = useState(false);

  return (
    <>
    <PanouProjectCard
      accentColor={project.color}
      title={project.code}
      status={project.status}
      titleSubline={project.denumireLucrare}
      // Only the finish here: complexity lives in the details, once.
      infoContent={
        project.finisaj ? (
          <span className="flex min-w-0 flex-wrap items-center gap-x-2.5 gap-y-1">
            <FinisajBadge value={project.finisaj} />
          </span>
        ) : undefined
      }
      sideActions={<PinnedProjectReportButton onOpen={onOpenReport} />}
      hideLeadingIcon={!showPinButton}
      cornerSlot={
        dragHandleProps ? (
          // A quarter circle in the corner the card's rounding cuts: out of the
          // way of the content, and a big enough target to grab.
          <button
            type="button"
            className="absolute bottom-0 left-0 z-10 flex size-7 cursor-grab items-end justify-start rounded-tr-full pb-1 pl-1 transition-colors active:cursor-grabbing"
            style={{
              backgroundColor: panouAccentTint(project.color, '24%'),
              color: project.color ?? NEUTRAL_ACCENT,
            }}
            aria-label="Reordonează proiectul"
            title="Trage pentru a reordona"
            {...dragHandleProps.attributes}
            {...dragHandleProps.listeners}
          >
            <i className="ti ti-grip-vertical text-sm leading-none" aria-hidden="true" />
          </button>
        ) : undefined
      }
      titleHandleProps={titleHandleProps}
      subtitle={project.company.name}
      detailsContent={
        <PinnedProjectDetails
          project={project}
          expanded={expanded}
          onToggle={onToggle}
          onOpenAssemblies={() => setAssembliesOpen(true)}
        />
      }
      totalMinutes={project.totalMinutes}
      progressPercent={project.progressPercent}
      expanded={expanded}
      onToggle={onToggle}
      leadingSlot={
        showPinButton ? (
          <div className="mt-0.5 flex shrink-0 flex-col items-center gap-0.5">
            <PinnedProjectPinButton
              project={project}
              onUnpinned={(updated) => {
                if (!updated.isPinned) {
                  onUnpinned(updated);
                }
              }}
            />
          </div>
        ) : undefined
      }
      durationTopActions={
        <>
          <PinnedProjectEditButton onEdit={onEdit} />
          <PinnedProjectMoreMenu
            projectId={project.id}
            assemblyCount={project.assemblyCount}
            onOpenAssemblies={() => setAssembliesOpen(true)}
          />
        </>
      }
      expandedContent={
        project.activities.length > 0 ? (
          <ActivityBreakdownRows
            activities={project.activities}
            progressPercent={project.progressPercent}
            // Pinned cards total every pontaj ever logged, whatever the toolbar period.
            timesheets={{
              projectId: project.id,
              period: allTimePeriod(),
              returnPoint: returnPoint ?? { projectId: project.id, source: 'pinned' },
            }}
          />
        ) : (
          <p className="text-sm text-text-muted">
            {formatDurationMinutes(project.totalMinutes)} total logat
          </p>
        )
      }
    />

    {assembliesOpen && (
      <AssemblyListScreen
        open
        variant="progress"
        projectId={project.id}
        projectName={project.name}
        onClose={() => setAssembliesOpen(false)}
        onChanged={onAssembliesChanged}
      />
    )}
    </>
  );
}
