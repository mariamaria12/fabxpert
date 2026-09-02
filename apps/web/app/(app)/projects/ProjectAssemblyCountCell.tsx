'use client';

import type { ProjectDto } from '@fabxpert/shared';
import { useState } from 'react';
import { AssemblyListScreen } from './AssemblyListScreen';

/**
 * Assembly count for a project row, with a button that opens the list. Owns the
 * modal so both project tables can drop the cell in without extra wiring; the
 * click is kept off the row, which opens the edit panel.
 */
export function ProjectAssemblyCountCell({ project }: { project: ProjectDto }) {
  const [listOpen, setListOpen] = useState(false);

  if (project.assemblyCount === 0) {
    return <span className="text-text-muted">—</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setListOpen(true);
        }}
        title={`Vezi cele ${project.assemblyCount} ansamble`}
        aria-label={`Vezi ansamblele proiectului ${project.code}`}
        className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 text-text-secondary transition-colors hover:bg-surface-raised hover:text-accent"
      >
        <span className="tabular-nums">{project.assemblyCount}</span>
        <i className="ti ti-eye text-sm" aria-hidden="true" />
      </button>

      {listOpen && (
        <div onClick={(event) => event.stopPropagation()}>
          <AssemblyListScreen
            open={listOpen}
            projectId={project.id}
            projectName={project.name}
            onClose={() => setListOpen(false)}
          />
        </div>
      )}
    </>
  );
}
