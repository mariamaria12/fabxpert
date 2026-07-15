'use client';

import { updateProject, type ProjectDto } from '@fabxpert/shared';
import { useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

export type ProjectPinTarget = Pick<ProjectDto, 'id' | 'isPinned'>;

export function ProjectPinButton({
  project,
  onToggled,
}: {
  project: ProjectPinTarget;
  onToggled: (updated: ProjectDto) => void;
}) {
  const { showToast } = useToast();
  const [pending, setPending] = useState(false);

  async function handleClick(event: React.MouseEvent) {
    event.stopPropagation();
    if (pending) {
      return;
    }

    setPending(true);
    try {
      const updated = await updateProject(project.id, { isPinned: !project.isPinned });
      onToggled(updated);
      showToast(updated.isPinned ? 'Proiect fixat' : 'Fixare anulată', 'success');
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setPending(false);
    }
  }

  const label = project.isPinned ? 'Anulează fixarea' : 'Fixează proiectul';

  return (
    <button
      type="button"
      onClick={(event) => void handleClick(event)}
      disabled={pending}
      aria-label={label}
      aria-pressed={project.isPinned}
      className="flex size-11 shrink-0 items-center justify-center rounded transition-colors hover:bg-surface-raised disabled:opacity-50"
    >
      <i
        className={`ti ${project.isPinned ? 'ti-pinned text-accent' : 'ti-pin text-text-muted'} text-lg`}
        aria-hidden="true"
      />
    </button>
  );
}
