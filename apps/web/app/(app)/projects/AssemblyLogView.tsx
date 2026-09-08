'use client';

import {
  assemblyDoneForActivity,
  listActivities,
  setAssemblyManualProgress,
  type ActivityDto,
  type ProjectAssemblyDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface AssemblyLogViewProps {
  projectId: string;
  assemblies: ProjectAssemblyDto[];
  /** Rows came back from a write and replace what the list screen holds. */
  onAssembliesChanged: (updated: ProjectAssemblyDto[]) => void;
  /**
   * Raised while a write is in flight, with the line for the loader; null when
   * idle. The panel around this view owns the blocking overlay.
   */
  onBusyChange: (label: string | null) => void;
  disabled: boolean;
}

/** Pieces closed by hand for one activity, out of the total already done. */
function manualForActivity(assembly: ProjectAssemblyDto, activityId: string): number {
  return assembly.progress.find((row) => row.activityId === activityId)?.manualQuantity ?? 0;
}

type RowState = {
  done: number;
  manual: number;
  /** Pieces still open — what a tick claims unless the count is edited. */
  remaining: number;
  isComplete: boolean;
  /** Finished purely through timesheets: there is nothing manual to undo. */
  isLockedByTimesheets: boolean;
  /**
   * A finished line has nothing left to mark. One finished by hand stays
   * selectable anyway, because clearing that mark is the only way to undo it.
   */
  isSelectable: boolean;
};

function rowState(assembly: ProjectAssemblyDto, activityId: string): RowState {
  const done = assemblyDoneForActivity(assembly, activityId);
  const manual = manualForActivity(assembly, activityId);
  const isComplete = done >= assembly.quantity;

  return {
    done,
    manual,
    remaining: Math.max(0, assembly.quantity - done),
    isComplete,
    isLockedByTimesheets: done - manual >= assembly.quantity,
    isSelectable: !isComplete || manual > 0,
  };
}

/** Counts are typed straight into the row, so only digits get through. */
function sanitizeQuantity(raw: string): string {
  return raw.replace(/\D/g, '').slice(0, 6);
}

function matchesSearch(assembly: ProjectAssemblyDto, search: string): boolean {
  const query = search.trim().toLowerCase();
  if (!query) {
    return true;
  }

  return (
    assembly.name.toLowerCase().includes(query) ||
    (assembly.profile ?? '').toLowerCase().includes(query)
  );
}

/**
 * "Asamblare" → "asamblat", "Vopsire" → "vopsit". Romanian verbal nouns turn
 * into the participle by ending, so the button follows an activity that gets
 * renamed rather than a hardcoded list of names. A name not shaped like one
 * returns null and the caller falls back to naming the activity itself.
 */
function pastParticiple(activityName: string): string | null {
  const name = activityName.trim().toLowerCase();
  if (name.length <= 3) {
    return null;
  }

  const stem = name.slice(0, -3);
  if (name.endsWith('âre')) {
    return `${stem}ât`;
  }
  if (name.endsWith('are')) {
    return `${stem}at`;
  }
  if (name.endsWith('ire')) {
    return `${stem}it`;
  }

  return null;
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * Tick off work that never went through a timesheet — outsourced marks, or
 * pieces finished before the project reached the app.
 *
 * One tab per activity that tracks assemblies, in the order fabrication runs
 * them. Marking a set moves to the next tab with the same marks still selected,
 * because a batch that was assembled is usually the batch about to be welded —
 * the selection is a suggestion, and unticking a few is the expected move.
 */
export function AssemblyLogView({
  projectId,
  assemblies,
  onAssembliesChanged,
  onBusyChange,
  disabled,
}: AssemblyLogViewProps) {
  const { showToast } = useToast();
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [activeActivityId, setActiveActivityId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  /** Counts the admin typed over the default. Keyed by assembly id, raw text. */
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [search, setSearch] = useState('');
  const [note, setNote] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const rows = await listActivities();
      const tracked = rows.filter((activity) => activity.tracksAssemblies);
      setActivities(tracked);
      setActiveActivityId(tracked[0]?.id ?? null);
    } catch (caught) {
      setActivities([]);
      setError(apiErrorToastMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const activeActivity = activities.find((activity) => activity.id === activeActivityId) ?? null;

  const visibleAssemblies = useMemo(
    () => assemblies.filter((assembly) => matchesSearch(assembly, search)),
    [assemblies, search],
  );

  /** What the two action buttons may touch, once the finished rows are dropped. */
  const actionable = useMemo(() => {
    const markable: { assemblyId: string; quantityDone?: number }[] = [];
    const clearable: { assemblyId: string }[] = [];

    if (!activeActivity) {
      return { markable, clearable };
    }

    for (const assembly of assemblies) {
      if (!selectedIds.has(assembly.id)) {
        continue;
      }
      const state = rowState(assembly, activeActivity.id);
      if (!state.isComplete) {
        const typed = Number(quantities[assembly.id] ?? '');
        markable.push({
          assemblyId: assembly.id,
          // An empty or zeroed cell falls back to "close the line" server-side.
          quantityDone: Number.isInteger(typed) && typed > 0 ? typed : undefined,
        });
      }
      if (state.manual > 0) {
        clearable.push({ assemblyId: assembly.id });
      }
    }

    return { markable, clearable };
  }, [assemblies, selectedIds, quantities, activeActivity]);

  const isBusy = disabled || isSaving;

  function toggleRow(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  function selectAllVisible() {
    if (!activeActivity) {
      return;
    }

    setSelectedIds((current) => {
      const next = new Set(current);
      for (const assembly of visibleAssemblies) {
        if (rowState(assembly, activeActivity.id).isSelectable) {
          next.add(assembly.id);
        }
      }
      return next;
    });
  }

  async function runWrite(
    entries: { assemblyId: string; quantityDone?: number }[],
    done: boolean,
    busyLabel: string,
    onDone: () => void,
  ) {
    if (!activeActivity || entries.length === 0 || isBusy) {
      return;
    }

    setIsSaving(true);
    onBusyChange(busyLabel);

    try {
      const updated = await setAssemblyManualProgress(projectId, {
        activityId: activeActivity.id,
        assemblies: entries,
        done,
        note: done ? note.trim() || null : null,
      });
      onAssembliesChanged(updated);
      onDone();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSaving(false);
      onBusyChange(null);
    }
  }

  async function handleMark() {
    const marked = actionable.markable.length;
    const activity = activeActivity;
    if (!activity) {
      return;
    }

    const nextActivity =
      activities[activities.findIndex((entry) => entry.id === activity.id) + 1] ?? null;

    await runWrite(
      actionable.markable,
      true,
      `Se marchează ${countLabel(marked, 'ansamblu', 'ansamble')}…`,
      () => {
        if (nextActivity) {
          showToast(
            `${countLabel(marked, 'ansamblu marcat', 'ansamble marcate')} · continuă cu ${nextActivity.name.toLowerCase()}`,
            'success',
          );
          setActiveActivityId(nextActivity.id);
          setQuantities({});
        } else {
          showToast(countLabel(marked, 'ansamblu marcat', 'ansamble marcate'), 'success');
          setSelectedIds(new Set());
          setQuantities({});
        }
      },
    );
  }

  async function handleClear() {
    const cleared = actionable.clearable.length;

    await runWrite(
      actionable.clearable,
      false,
      `Se șterge marcajul de pe ${countLabel(cleared, 'ansamblu', 'ansamble')}…`,
      () => showToast('Marcajul manual a fost șters', 'success'),
    );
  }

  const participle = activeActivity ? pastParticiple(activeActivity.name) : null;
  // Falls back to naming the activity when its name is not a verbal noun, which
  // keeps the button grammatical whatever an admin renames it to.
  const markLabel = participle
    ? `Marchează ca ${participle}`
    : activeActivity
      ? `Marchează la ${activeActivity.name}`
      : 'Marchează';

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {activities.length > 0 && (
        <div className="flex gap-1 border-b border-border-subtle px-6" role="tablist">
          {activities.map((activity) => {
            const isActive = activity.id === activeActivityId;
            return (
              <button
                key={activity.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                disabled={isBusy}
                onClick={() => {
                  setActiveActivityId(activity.id);
                  setQuantities({});
                }}
                className={`-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  isActive
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                <span
                  className="size-1.5 shrink-0 rounded-full"
                  style={{ backgroundColor: activity.color ?? 'var(--color-border-subtle)' }}
                  aria-hidden="true"
                />
                {activity.name}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-center gap-2 border-b border-border-subtle px-6 py-2.5">
        <div className="relative flex-1">
          <i
            className="ti ti-search pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-text-muted"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            disabled={isBusy}
            aria-label="Caută marca sau profilul"
            placeholder="Caută marca sau profilul…"
            onChange={(event) => setSearch(event.target.value)}
            className="w-full rounded-md border border-border bg-surface-raised py-1.5 pl-8 pr-2.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-40"
          />
        </div>
        <span className="whitespace-nowrap text-xs text-text-muted">
          {selectedIds.size} selectate
        </span>
        <button
          type="button"
          disabled={isBusy || visibleAssemblies.length === 0}
          onClick={selectAllVisible}
          className="whitespace-nowrap rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Selectează tot
        </button>
        <button
          type="button"
          disabled={isBusy || selectedIds.size === 0}
          onClick={() => setSelectedIds(new Set())}
          className="whitespace-nowrap rounded px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
        >
          Deselectează tot
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-3">
        {isLoading ? (
          <p className="py-8 text-center text-sm text-text-muted">Se încarcă…</p>
        ) : error ? (
          <p role="alert" className="py-8 text-center text-sm text-danger">
            {error}
          </p>
        ) : activities.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            Nicio activitate nu urmărește ansamble. Activează opțiunea din Administrare →
            Activități.
          </p>
        ) : visibleAssemblies.length === 0 ? (
          <p className="py-8 text-center text-sm text-text-muted">
            {search.trim() ? 'Nicio marcă găsită.' : 'Proiectul nu are listă de ansamble.'}
          </p>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {visibleAssemblies.map((assembly) => {
              const state = activeActivity ? rowState(assembly, activeActivity.id) : null;
              const isSelected = selectedIds.has(assembly.id);
              const meta = [assembly.profile, assembly.length ? `${assembly.length} mm` : null]
                .filter(Boolean)
                .join(' · ');

              const canSelect = !isBusy && (state?.isSelectable ?? false);
              const showQuantity = isSelected && state !== null && !state.isComplete;

              return (
                  <li key={assembly.id}>
                    <label
                      className={`flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors ${
                        canSelect
                          ? 'cursor-pointer hover:bg-surface-raised'
                          : 'cursor-not-allowed opacity-50'
                      } ${isSelected ? 'bg-surface-raised' : ''}`}
                      title={
                        state?.isLockedByTimesheets
                          ? 'Acoperit din pontaje — se corectează din Pontaje'
                          : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={!canSelect}
                        onChange={() => toggleRow(assembly.id)}
                        className="size-4 shrink-0 rounded border-border accent-accent"
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm text-text-primary">
                          {assembly.name}
                        </span>
                        {meta && (
                          <span className="block truncate text-xs text-text-muted">{meta}</span>
                        )}
                      </span>
                      {state && (
                        <span className="flex shrink-0 items-center gap-2">
                          {state.manual > 0 && (
                            <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                              manual
                            </span>
                          )}
                          {state.isLockedByTimesheets && (
                            <span className="rounded-full bg-surface-raised px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-text-muted">
                              pontat
                            </span>
                          )}
                          {showQuantity ? (
                            <input
                              type="text"
                              inputMode="numeric"
                              value={quantities[assembly.id] ?? String(state.remaining)}
                              disabled={isBusy}
                              aria-label={`Bucăți de marcat pentru ${assembly.name}`}
                              onClick={(event) => event.preventDefault()}
                              onChange={(event) =>
                                setQuantities((current) => ({
                                  ...current,
                                  [assembly.id]: sanitizeQuantity(event.target.value),
                                }))
                              }
                              className="w-14 rounded border border-border bg-surface px-1.5 py-0.5 text-right font-mono text-xs tabular-nums text-text-primary focus:border-accent focus:outline-none"
                            />
                          ) : null}
                          <span
                            className={`w-16 text-right font-mono text-xs tabular-nums ${
                              state.isComplete ? 'text-success-text' : 'text-text-muted'
                            }`}
                          >
                            {state.done} / {assembly.quantity}
                          </span>
                        </span>
                      )}
                    </label>
                  </li>
                );
            })}
          </ul>
        )}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border-subtle px-6 py-3">
        <input
          type="text"
          value={note}
          disabled={isBusy}
          aria-label="Notă (opțional)"
          placeholder="Notă, ex. subcontractat Metalica"
          onChange={(event) => setNote(event.target.value)}
          className="min-w-[12rem] flex-1 rounded-md border border-border bg-surface-raised px-2.5 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none disabled:opacity-40"
        />
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            disabled={isBusy || actionable.clearable.length === 0}
            onClick={handleClear}
            className="rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            Șterge marcajul ({actionable.clearable.length})
          </button>
          <button
            type="button"
            disabled={isBusy || actionable.markable.length === 0}
            onClick={handleMark}
            className="rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {markLabel} ({actionable.markable.length})
          </button>
        </div>
      </div>
    </div>
  );
}
