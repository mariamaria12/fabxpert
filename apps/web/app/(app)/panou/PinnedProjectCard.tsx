'use client';

import type { PinnedProjectSummaryRow, ProjectDto } from '@fabxpert/shared';
import { updateProject } from '@fabxpert/shared';
import { useState } from 'react';
import { formatDurationMinutes } from '@/app/(app)/timesheets/timesheetFormat';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { AssemblyListScreen } from '@/app/(app)/projects/AssemblyListScreen';
import { FinisajBadge } from '@/components/FinisajBadge';
import { ActivityBreakdownRows } from './ActivityBreakdownRows';
import type { PanouReturnPoint } from './panouReturnPoint';
import { allTimePeriod } from '@/utils/timesheetListNavigation';
import { NEUTRAL_ACCENT, panouAccentTint } from './panouColors';
import { PanouProjectCard } from './PanouProjectCard';
import { PinnedProjectDetails } from './PinnedProjectDetails';
import { ProjectVisibleForChipSummary } from './panouProjectVisibility';
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
      // Finish and roles live in the details rows; phones lift them up here, under
      // the client, so the rows below stay two columns wide.
      infoContent={
        <span className="flex min-w-0 flex-wrap items-center gap-1.5">
          {project.finisaj ? <FinisajBadge value={project.finisaj} /> : null}
          <span className="inline-flex items-center gap-1" title="Vizibil pentru">
            <i className="ti ti-eye text-sm text-text-muted" aria-hidden="true" />
            <span className="sr-only">Vizibil pentru:</span>
            <ProjectVisibleForChipSummary
              roles={project.visibleForRoles}
              readyForExecution={project.readyForExecution}
            />
          </span>
        </span>
      }
      infoContentClassName="md:hidden"
      stackActionsOnPhones
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
      durationTopActions={<PinnedProjectEditButton onEdit={onEdit} />}
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
