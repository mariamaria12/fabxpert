'use client';

import { listProjects, type ProjectDto } from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { loadAllProjects, projectOptionLabel, toProjectOption } from './projectOptions';
import { SearchableSelect } from '@/components/SearchableSelect';
import { SelectField } from '@/components/SelectField';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

const LOOKUP_PAGE_SIZE = 500;

/** The list the project field offers: today's work, or everything ever. */
type ProjectScope = 'ready' | 'all';

export interface TimesheetProjectLists {
  readyProjects: ProjectDto[];
  /** Null until someone asks for the full list. */
  allProjects: ProjectDto[] | null;
  isLoadingAll: boolean;
  /** Resolves to false when the full list could not be loaded. */
  loadAll: () => Promise<boolean>;
}

/**
 * The projects a pontaj form picks from: the ones ready for execution up front,
 * the full list only on demand. One call serves every project field in a panel.
 */
export function useTimesheetProjectLists(open: boolean): TimesheetProjectLists {
  const { showToast } = useToast();
  const [readyProjects, setReadyProjects] = useState<ProjectDto[]>([]);
  const [allProjects, setAllProjects] = useState<ProjectDto[] | null>(null);
  const [isLoadingAll, setIsLoadingAll] = useState(false);
  const allRequest = useRef<Promise<boolean> | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;

    listProjects({ page: 1, pageSize: LOOKUP_PAGE_SIZE, compact: true, readyForExecution: true })
      .then((response) => {
        if (!cancelled) {
          setReadyProjects(response.data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReadyProjects([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open]);

  const loadAll = useCallback((): Promise<boolean> => {
    if (allRequest.current) {
      return allRequest.current;
    }

    setIsLoadingAll(true);
    const request = loadAllProjects()
      .then((projects) => {
        setAllProjects(projects);
        return true;
      })
      .catch((caught: unknown) => {
        // Forgotten, so the next click tries again.
        allRequest.current = null;
        showToast(apiErrorToastMessage(caught), 'error');
        return false;
      })
      .finally(() => setIsLoadingAll(false));

    allRequest.current = request;
    return request;
  }, [showToast]);

  return { readyProjects, allProjects, isLoadingAll, loadAll };
}

export interface TimesheetProjectFieldProps {
  id: string;
  value: string;
  lists: TimesheetProjectLists;
  /** The project already saved on the pontaj being edited. */
  savedProject?: { id: string; code: string; name: string; company: { name: string } };
  error?: string;
  disabled?: boolean;
  /** Lets the field go back to no project at all. */
  allowEmpty?: boolean;
  onChange: (value: string) => void;
}

/**
 * Project picker of a pontaj: the projects ready for execution by default, with
 * a link that switches to a search through every project.
 */
export function TimesheetProjectField({
  id,
  value,
  lists,
  savedProject,
  error,
  disabled = false,
  allowEmpty = false,
  onChange,
}: TimesheetProjectFieldProps) {
  const [scope, setScope] = useState<ProjectScope>('ready');
  const { readyProjects, allProjects, isLoadingAll, loadAll } = lists;

  // The selected project may not be in execution — an older entry being
  // edited, or one just picked from the full list.
  const selected =
    savedProject?.id === value
      ? savedProject
      : allProjects?.find((project) => project.id === value);

  const readyOptions = readyProjects.map((project) => ({
    id: project.id,
    label: projectOptionLabel(project),
  }));
  if (value && selected && !readyOptions.some((option) => option.id === value)) {
    readyOptions.unshift({ id: selected.id, label: projectOptionLabel(selected) });
  }

  async function showAllProjects() {
    setScope('all');
    if (!(await loadAll())) {
      setScope('ready');
    }
  }

  return (
    <div className="flex flex-col gap-1.5">
      {scope === 'ready' ? (
        <SelectField
          id={id}
          label="Proiect"
          value={value}
          error={error}
          disabled={disabled}
          required
          allowEmpty={allowEmpty}
          placeholder="Selectează proiectul"
          options={readyOptions}
          onChange={onChange}
        />
      ) : (
        <SearchableSelect
          id={id}
          label="Proiect"
          value={value || null}
          error={error}
          disabled={disabled || isLoadingAll}
          required
          clearable={allowEmpty}
          selectedLabel={selected ? projectOptionLabel(selected) : undefined}
          placeholder={isLoadingAll ? 'Se încarcă proiectele…' : 'Caută proiectul…'}
          emptyMessage="Niciun proiect găsit."
          options={(allProjects ?? []).map(toProjectOption)}
          onChange={(next) => onChange(next ?? '')}
        />
      )}
      {scope === 'ready' ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => void showAllProjects()}
          className="self-start text-xs text-accent hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Caută în toate proiectele
        </button>
      ) : (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setScope('ready')}
          className="self-start text-xs text-text-muted hover:text-text-secondary hover:underline disabled:cursor-not-allowed disabled:opacity-50"
        >
          Doar proiectele pregătite de execuție
        </button>
      )}
    </div>
  );
}
