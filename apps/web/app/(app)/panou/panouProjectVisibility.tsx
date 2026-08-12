'use client';

import type { EmployeeRoleDto, ProjectVisibleRoleDto } from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import { buildStableIndexMap, getRolePaletteColor } from '@/components/roleColors';
import { getProjectFormEmployeeRoles } from '@/utils/projectFormLookups';

export function formatProjectVisibleForLabel(
  roles: ProjectVisibleRoleDto[] | undefined | null,
  readyForExecution?: boolean,
): string {
  if (readyForExecution === false) {
    return 'Nimeni';
  }

  const list = roles ?? [];
  if (list.length === 0) {
    return 'Toți';
  }

  return list.map((role) => role.name).join(', ');
}

/** Above this many roles the chips collapse behind a count (cards and tables). */
const VISIBLE_FOR_CHIP_LIMIT = 2;

/** Outline only — the role colour lives in the border and the text. */
const CHIP_CLASS =
  'inline-flex max-w-full items-center rounded border px-1 py-px text-[10px] leading-4';

function ReadOnlyRoleChip({ name, color }: { name: string; color: string }) {
  return (
    <span className={CHIP_CLASS} style={{ borderColor: color, color }}>
      <span className="truncate">{name}</span>
    </span>
  );
}

function useRoleColorById(): Map<string, string> {
  const [employeeRoles, setEmployeeRoles] = useState<EmployeeRoleDto[]>([]);

  useEffect(() => {
    void getProjectFormEmployeeRoles()
      .then(setEmployeeRoles)
      .catch(() => {
        setEmployeeRoles([]);
      });
  }, []);

  return useMemo(() => {
    const stableIndexById = buildStableIndexMap(employeeRoles);
    const colors = new Map<string, string>();

    for (const role of employeeRoles) {
      colors.set(role.id, getRolePaletteColor(stableIndexById.get(role.id) ?? 0));
    }

    return colors;
  }, [employeeRoles]);
}

function roleChipColor(role: ProjectVisibleRoleDto, roleColorById: Map<string, string>): string {
  return roleColorById.get(role.id) ?? getRolePaletteColor(role.id.length);
}

export function ProjectVisibleForRoleChips({
  roles,
  readyForExecution,
  className,
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
  readyForExecution?: boolean;
  className?: string;
}) {
  const roleColorById = useRoleColorById();
  const list = roles ?? [];

  if (readyForExecution === false) {
    return <span className={`${CHIP_CLASS} border-accent text-accent`}>Nimeni</span>;
  }

  if (list.length === 0) {
    return <span className={`${CHIP_CLASS} border-success text-success`}>Toți</span>;
  }

  const label = formatProjectVisibleForLabel(list, readyForExecution);

  return (
    <span className={`inline-flex flex-wrap items-center gap-1 ${className ?? ''}`} title={label}>
      {list.map((role) => (
        <ReadOnlyRoleChip
          key={role.id}
          name={role.name}
          color={roleChipColor(role, roleColorById)}
        />
      ))}
    </span>
  );
}

export function ProjectVisibleForCell({
  roles,
  readyForExecution,
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
  readyForExecution?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = roles ?? [];
  const collapsible =
    readyForExecution !== false && list.length > VISIBLE_FOR_CHIP_LIMIT;

  if (!collapsible) {
    return (
      <ProjectVisibleForRoleChips
        roles={roles}
        readyForExecution={readyForExecution}
      />
    );
  }

  return (
    <span className="flex flex-wrap items-center gap-1">
      {expanded ? (
        <ProjectVisibleForRoleChips
          roles={roles}
          readyForExecution={readyForExecution}
          className="min-w-0 flex-1"
        />
      ) : (
        <span
          className="text-xs text-text-secondary"
          title={formatProjectVisibleForLabel(list, readyForExecution)}
        >
          {list.length}
        </span>
      )}
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          setExpanded((current) => !current);
        }}
        aria-expanded={expanded}
        aria-label={expanded ? 'Ascunde funcțiile' : 'Afișează funcțiile'}
        className="flex size-5 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text-secondary"
      >
        <i
          className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm`}
          aria-hidden="true"
        />
      </button>
    </span>
  );
}

export function ProjectVisibleForCardMeta({
  roles,
  readyForExecution,
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
  readyForExecution?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const list = roles ?? [];
  // "Nimeni" and "Toți" are single words — only real role lists collapse.
  const collapsible =
    readyForExecution !== false && list.length > VISIBLE_FOR_CHIP_LIMIT;

  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      {/* Phones show just the eye — the label needs the width more than the card
          has to spare. Colour lives in the chips next to it. */}
      <span
        className="flex shrink-0 items-center gap-1 text-[11px] text-text-secondary"
        title="Vizibil pentru"
      >
        <i className="ti ti-eye text-sm md:hidden" aria-hidden="true" />
        <span className="sr-only md:not-sr-only">Vizibil pentru:</span>
        {collapsible && !expanded ? <span>{list.length}</span> : null}
      </span>

      {(!collapsible || expanded) && (
        <ProjectVisibleForRoleChips
          roles={roles}
          readyForExecution={readyForExecution}
          className="min-w-0 flex-1"
        />
      )}

      {collapsible && (
        <button
          type="button"
          onClick={() => setExpanded((current) => !current)}
          aria-expanded={expanded}
          aria-label={expanded ? 'Ascunde funcțiile' : 'Afișează funcțiile'}
          className="flex size-5 shrink-0 items-center justify-center rounded text-text-muted transition-colors hover:text-text-secondary"
        >
          <i
            className={`ti ${expanded ? 'ti-chevron-up' : 'ti-chevron-down'} text-sm`}
            aria-hidden="true"
          />
        </button>
      )}
    </span>
  );
}
