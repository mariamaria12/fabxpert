'use client';

import type { EmployeeRoleDto, ProjectVisibleRoleDto } from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import {
  buildStableIndexMap,
  contrastTextOnHex,
  getRolePaletteColor,
} from '@/components/roleColors';
import { getProjectFormEmployeeRoles } from '@/utils/projectFormLookups';

export function formatProjectVisibleForLabel(
  roles: ProjectVisibleRoleDto[] | undefined | null,
): string {
  const list = roles ?? [];
  if (list.length === 0) {
    return 'Toți';
  }

  return list.map((role) => role.name).join(', ');
}

function ReadOnlyRoleChip({ name, color }: { name: string; color: string }) {
  const textColor = contrastTextOnHex(color);

  return (
    <span
      className="inline-flex max-w-full items-center rounded border px-1 py-px text-[10px] leading-4"
      style={{
        backgroundColor: color,
        borderColor: color,
        color: textColor,
      }}
    >
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
  className,
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
  className?: string;
}) {
  const roleColorById = useRoleColorById();
  const list = roles ?? [];

  if (list.length === 0) {
    return <span className="text-text-muted">Toți</span>;
  }

  const label = formatProjectVisibleForLabel(list);

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
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
}) {
  return <ProjectVisibleForRoleChips roles={roles} />;
}

export function ProjectVisibleForCardMeta({
  roles,
}: {
  roles: ProjectVisibleRoleDto[] | undefined | null;
}) {
  return (
    <span className="mt-0.5 flex flex-wrap items-center gap-1">
      <span className="shrink-0 text-[11px] text-text-muted">Vizibil pentru:</span>
      <ProjectVisibleForRoleChips roles={roles} className="min-w-0 flex-1" />
    </span>
  );
}
