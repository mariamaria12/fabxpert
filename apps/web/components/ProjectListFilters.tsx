'use client';

import type { ProjectStatus } from '@fabxpert/shared';
import { useEffect, useState } from 'react';
import { SearchableMultiSelect } from '@/components/SearchableMultiSelect';
import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/SearchableSelect';
import { useBusinessAutofillProps } from '@/components/inputAutofill';
import {
  buildStableIndexMap,
  getRolePaletteColor,
} from '@/components/roleColors';
import { getProjectFormEmployeeRoles } from '@/utils/projectFormLookups';
import { VISIBILITY_EVERYONE_VALUE } from '@/utils/projectStatusFilter';

const searchInputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

const READY_FOR_EXECUTION_OPTIONS: SearchableSelectOption[] = [
  { id: 'true', label: 'Da' },
  { id: 'false', label: 'Nu' },
];

export type ProjectListFiltersProps = {
  idPrefix: string;
  statusOptions: SearchableSelectOption[];
  statusValues: ProjectStatus[];
  onStatusChange: (values: ProjectStatus[]) => void;
  visibilityValues: string[];
  onVisibilityChange: (values: string[]) => void;
  /** `null` = no filter; `true`/`false` = only ready / not ready. */
  readyForExecution: boolean | null;
  onReadyForExecutionChange: (value: boolean | null) => void;
  search?: {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    'aria-label'?: string;
  };
  className?: string;
};

export function ProjectListFilters({
  idPrefix,
  statusOptions,
  statusValues,
  onStatusChange,
  visibilityValues,
  onVisibilityChange,
  readyForExecution,
  onReadyForExecutionChange,
  search,
  className,
}: ProjectListFiltersProps) {
  const businessAutofill = useBusinessAutofillProps();
  const [visibilityOptions, setVisibilityOptions] = useState<SearchableSelectOption[]>([
    { id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' },
  ]);

  useEffect(() => {
    let cancelled = false;

    void getProjectFormEmployeeRoles()
      .then((roles) => {
        if (cancelled) {
          return;
        }

        const activeRoles = roles.filter((role) => role.isActive);
        const roleColorById = buildStableIndexMap(activeRoles);

        setVisibilityOptions([
          { id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' },
          ...activeRoles.map((role) => ({
            id: role.id,
            label: role.name,
            color: getRolePaletteColor(roleColorById.get(role.id) ?? 0),
          })),
        ]);
      })
      .catch(() => {
        if (!cancelled) {
          setVisibilityOptions([{ id: VISIBILITY_EVERYONE_VALUE, label: 'Toți' }]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const readyForExecutionValue =
    readyForExecution === null ? null : readyForExecution ? 'true' : 'false';

  return (
    <div className={className}>
      {search && (
        <div className="max-w-md">
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder ?? 'Caută după denumire, cod sau client...'}
            aria-label={search['aria-label'] ?? 'Caută după denumire, cod sau client'}
            className={searchInputClassName}
            {...businessAutofill}
          />
        </div>
      )}

      <div className={`grid grid-cols-3 gap-3${search ? ' mt-3' : ''}`}>
        <div className="min-w-0">
          <SearchableMultiSelect
            id={`${idPrefix}-status-filter`}
            label="Status"
            placeholder="Filtrează după status…"
            emptyMessage="Niciun status găsit."
            values={statusValues}
            options={statusOptions}
            onChange={(values) => onStatusChange(values as ProjectStatus[])}
          />
        </div>
        <div className="min-w-0">
          <SearchableMultiSelect
            id={`${idPrefix}-visibility-filter`}
            label="Vizibil pentru"
            placeholder="Filtrează după vizibilitate…"
            emptyMessage="Nicio opțiune găsită."
            values={visibilityValues}
            options={visibilityOptions}
            onChange={onVisibilityChange}
          />
        </div>
        <div className="min-w-0">
          <SearchableSelect
            id={`${idPrefix}-ready-for-execution-filter`}
            label="Gata de execuție"
            placeholder="Toate"
            emptyMessage="Nicio opțiune găsită."
            value={readyForExecutionValue}
            options={READY_FOR_EXECUTION_OPTIONS}
            onChange={(value) => {
              if (value === 'true') {
                onReadyForExecutionChange(true);
                return;
              }
              if (value === 'false') {
                onReadyForExecutionChange(false);
                return;
              }
              onReadyForExecutionChange(null);
            }}
          />
        </div>
      </div>
    </div>
  );
}
