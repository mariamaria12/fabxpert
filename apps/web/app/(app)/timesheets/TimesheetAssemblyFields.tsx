'use client';

import {
  assemblyDoneForActivity,
  listProjectAssemblies,
  type ProjectAssemblyDto,
  type TimesheetAssemblyDto,
  type TimesheetAssemblyInput,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import { SelectField } from '@/components/SelectField';
import { FORM_LABEL_CLASS } from '@/components/formFieldStyles';

export interface TimesheetAssemblyFieldsProps {
  projectId: string;
  activityId: string;
  value: TimesheetAssemblyInput[];
  onChange: (next: TimesheetAssemblyInput[]) => void;
  /**
   * What this entry already had saved, so its own pieces are not counted twice
   * when the row says how much was done before.
   */
  savedAssemblies?: TimesheetAssemblyDto[];
  savedActivityId?: string | null;
  disabled?: boolean;
  idPrefix: string;
}

function assemblyMeta(assembly: ProjectAssemblyDto, doneBefore: number): string {
  const parts: string[] = [];

  if (assembly.profile) {
    parts.push(assembly.profile);
  }
  parts.push(
    doneBefore > 0
      ? `${doneBefore} făcute înainte, din ${assembly.quantity}`
      : `din ${assembly.quantity}`,
  );

  return parts.join(' · ');
}

/**
 * The assembly lines of one pontaj. Unlike the mobile picker, the office can go
 * over what the list still has open — often the list is the stale one — so the
 * row says it instead of stopping it.
 */
export function TimesheetAssemblyFields({
  projectId,
  activityId,
  value,
  onChange,
  savedAssemblies,
  savedActivityId,
  disabled = false,
  idPrefix,
}: TimesheetAssemblyFieldsProps) {
  const [assemblies, setAssemblies] = useState<ProjectAssemblyDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) {
      setAssemblies([]);
      return;
    }

    let cancelled = false;
    setIsLoading(true);
    setError(null);

    listProjectAssemblies(projectId)
      .then((data) => {
        if (!cancelled) {
          setAssemblies(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAssemblies([]);
          setError('Nu s-au putut încărca ansamblele proiectului.');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const byId = useMemo(
    () => new Map(assemblies.map((assembly) => [assembly.id, assembly])),
    [assemblies],
  );

  /** This entry's own contribution, only while it still sits on the same activity. */
  const savedByAssembly = useMemo(() => {
    if (!savedAssemblies || savedActivityId !== activityId) {
      return new Map<string, number>();
    }

    return new Map(savedAssemblies.map((link) => [link.assemblyId, link.quantityDone]));
  }, [savedAssemblies, savedActivityId, activityId]);

  function doneBefore(assembly: ProjectAssemblyDto): number {
    const done = assemblyDoneForActivity(assembly, activityId);
    return Math.max(0, done - (savedByAssembly.get(assembly.id) ?? 0));
  }

  function setQuantity(assemblyId: string, quantity: number) {
    if (quantity <= 0) {
      onChange(value.filter((link) => link.assemblyId !== assemblyId));
      return;
    }

    onChange(
      value.map((link) =>
        link.assemblyId === assemblyId ? { ...link, quantityDone: quantity } : link,
      ),
    );
  }

  const chosenIds = new Set(value.map((link) => link.assemblyId));
  const addOptions = assemblies
    .filter((assembly) => !chosenIds.has(assembly.id))
    .map((assembly) => ({
      id: assembly.id,
      label: `${assembly.name}${assembly.profile ? ` · ${assembly.profile}` : ''}`,
    }));

  const totalPieces = value.reduce((total, link) => total + link.quantityDone, 0);

  return (
    <div>
      <span className={FORM_LABEL_CLASS}>
        Ansamble{totalPieces > 0 ? ` · ${totalPieces} bucăți` : ''}
      </span>

      <div className="rounded-md border border-border-subtle bg-surface-raised">
        {value.length === 0 && (
          <p className="px-3 py-2.5 text-xs text-text-muted">
            {isLoading ? 'Se încarcă ansamblele…' : 'Niciun ansamblu pe acest pontaj.'}
          </p>
        )}

        {value.map((link) => {
          const assembly = byId.get(link.assemblyId);
          const before = assembly ? doneBefore(assembly) : 0;
          const isOverList = assembly ? before + link.quantityDone > assembly.quantity : false;

          return (
            <div
              key={link.assemblyId}
              className="flex items-center gap-3 border-b border-border-subtle px-3 py-2 last:border-b-0"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-sm font-medium text-text-primary">
                  {assembly?.name ??
                    savedAssemblies?.find((saved) => saved.assemblyId === link.assemblyId)?.name ??
                    '—'}
                </p>
                <p className="text-[11px] text-text-muted">
                  {assembly ? assemblyMeta(assembly, before) : 'Ansamblu din altă listă'}
                  {isOverList && assembly ? (
                    <span className="ml-1.5 text-danger">
                      · peste listă cu {before + link.quantityDone - assembly.quantity}
                    </span>
                  ) : null}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`O bucată mai puțin din ${assembly?.name ?? 'ansamblu'}`}
                  onClick={() => setQuantity(link.assemblyId, link.quantityDone - 1)}
                  className="inline-flex size-7 items-center justify-center rounded border border-border text-text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  −
                </button>
                <span className="min-w-8 text-center font-mono text-sm tabular-nums">
                  {link.quantityDone}
                </span>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`O bucată în plus din ${assembly?.name ?? 'ansamblu'}`}
                  onClick={() => setQuantity(link.assemblyId, link.quantityDone + 1)}
                  className="inline-flex size-7 items-center justify-center rounded border border-border text-text-primary transition-colors hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                >
                  +
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`Scoate ${assembly?.name ?? 'ansamblul'} de pe pontaj`}
                  title="Scoate de pe pontaj"
                  onClick={() => setQuantity(link.assemblyId, 0)}
                  className="inline-flex size-7 items-center justify-center rounded border border-border-subtle text-text-muted transition-colors hover:bg-surface hover:text-danger disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ti ti-x text-sm" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        })}

        {addOptions.length > 0 && (
          <div className="border-t border-border-subtle p-2">
            <SelectField
              id={`${idPrefix}-add-assembly`}
              label="Adaugă o marcă"
              value=""
              disabled={disabled || isLoading}
              allowEmpty
              placeholder="Alege marca…"
              options={addOptions}
              onChange={(assemblyId) => {
                if (assemblyId) {
                  onChange([...value, { assemblyId, quantityDone: 1 }]);
                }
              }}
            />
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1.5 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
