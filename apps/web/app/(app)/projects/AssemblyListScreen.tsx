'use client';

import {
  ApiError,
  assemblyDoneForActivity,
  assemblyListWeight,
  createProjectAssembly,
  deleteProjectAssembly,
  listProjectAssemblies,
  importProjectAssemblies,
  updateProjectAssembly,
  type AssemblyImportRowDto,
  type CreateProjectAssemblyInput,
  type ProjectAssemblyDto,
  type UpdateProjectAssemblyInput,
} from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { WeldingLoader } from '@/components/WeldingLoader';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { formatProjectWeight } from '@/utils/projectWeight';
import { AssemblyImportScreen } from './AssemblyImportScreen';

/**
 * `== null` on purpose: the type says the field is always there, but it arrives
 * over the wire and TypeScript cannot enforce that. A missing cell must render
 * as a dash, not take the table down.
 */
function formatNumber(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) {
    return '—';
  }
  return value.toLocaleString('ro-RO', { maximumFractionDigits: 2 });
}

/** Editable cells hold raw text; the value only becomes a number on save. */
type DraftRow = {
  name: string;
  quantity: string;
  profile: string;
  length: string;
  weightPerPiece: string;
};

type DraftField = keyof DraftRow;

const EMPTY_DRAFT: DraftRow = {
  name: '',
  quantity: '',
  profile: '',
  length: '',
  weightPerPiece: '',
};

function toDraft(assembly: ProjectAssemblyDto): DraftRow {
  return {
    name: assembly.name,
    quantity: String(assembly.quantity),
    profile: assembly.profile ?? '',
    length: assembly.length == null ? '' : String(assembly.length),
    weightPerPiece: assembly.weightPerPiece == null ? '' : String(assembly.weightPerPiece),
  };
}

function buildDrafts(assemblies: ProjectAssemblyDto[]): Record<string, DraftRow> {
  return Object.fromEntries(assemblies.map((assembly) => [assembly.id, toDraft(assembly)]));
}

function omitKey<T>(record: Record<string, T>, key: string): Record<string, T> {
  const next = { ...record };
  delete next[key];
  return next;
}

function hasProgress(assembly: ProjectAssemblyDto): boolean {
  return assembly.progress.some((entry) => entry.quantityDone > 0);
}

type TrackedActivity = { id: string; name: string; color: string | null };

/**
 * The activities that have reported pieces on this list, one column each.
 * There is no per-project list of steps, so the steps are whatever the shop
 * has logged so far — a project that only started cutting shows one column.
 */
function trackedActivitiesOf(assemblies: ProjectAssemblyDto[]): TrackedActivity[] {
  const byId = new Map<string, TrackedActivity>();
  for (const assembly of assemblies) {
    for (const entry of assembly.progress) {
      if (!byId.has(entry.activityId)) {
        byId.set(entry.activityId, {
          id: entry.activityId,
          name: entry.activityName,
          color: entry.activityColor,
        });
      }
    }
  }
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, 'ro-RO'));
}

/** Done for every tracked step. With nothing logged yet, nothing counts as done. */
function isAssemblyComplete(
  assembly: ProjectAssemblyDto,
  activities: TrackedActivity[],
): boolean {
  return (
    activities.length > 0 &&
    activities.every(
      (activity) => assemblyDoneForActivity(assembly, activity.id) >= assembly.quantity,
    )
  );
}

type ParsedCell = { ok: true; value: number | null } | { ok: false };

/** Blank means "not filled in", and both decimal separators are accepted. */
function parseDecimalCell(raw: string): ParsedCell {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: true, value: null };
  }

  const value = Number(trimmed.replace(',', '.'));
  if (!Number.isFinite(value) || value < 0) {
    return { ok: false };
  }

  return { ok: true, value };
}

function parseQuantityCell(raw: string): ParsedCell {
  const trimmed = raw.trim();
  const value = Number(trimmed);
  if (!trimmed || !Number.isInteger(value) || value < 1) {
    return { ok: false };
  }

  return { ok: true, value };
}

type RowUpdate = { id: string; name: string; input: UpdateProjectAssemblyInput };
type RowCreate = { id: string; name: string; input: CreateProjectAssemblyInput };
type RowDelete = { id: string; name: string };

/** Everything the save has to send, in the order it has to be sent. */
type SavePlan = { deletes: RowDelete[]; updates: RowUpdate[]; creates: RowCreate[] };

type ValidationResult =
  | { ok: true; plan: SavePlan }
  | { ok: false; message: string; invalid: Record<string, DraftField[]> };

/**
 * Everything the drafts have to satisfy before a single request goes out.
 * Rows marked for removal are skipped — whatever they hold is going away.
 */
function validateDrafts(
  assemblies: ProjectAssemblyDto[],
  drafts: Record<string, DraftRow>,
  newIds: string[],
  removedIds: Set<string>,
): ValidationResult {
  const invalid: Record<string, DraftField[]> = {};
  const messages: string[] = [];
  const seenNames = new Map<string, string>();

  const kept = assemblies.filter((assembly) => !removedIds.has(assembly.id));
  const rows: { id: string; existing: ProjectAssemblyDto | null }[] = [
    ...kept.map((assembly) => ({ id: assembly.id, existing: assembly })),
    ...newIds.map((id) => ({ id, existing: null })),
  ];

  function flag(id: string, field: DraftField) {
    invalid[id] = [...(invalid[id] ?? []), field];
  }

  for (const row of rows) {
    const draft = drafts[row.id];
    if (!draft) {
      continue;
    }

    const name = draft.name.trim();
    if (!name) {
      flag(row.id, 'name');
      messages.push('Fiecare ansamblu are nevoie de un nume.');
    } else {
      const key = name.toLocaleLowerCase('ro-RO');
      const duplicateOf = seenNames.get(key);
      if (duplicateOf) {
        flag(row.id, 'name');
        messages.push(`Numele „${name}” apare de două ori.`);
      } else {
        seenNames.set(key, row.id);
      }
    }

    if (!parseQuantityCell(draft.quantity).ok) {
      flag(row.id, 'quantity');
      messages.push('Numărul de bucăți trebuie să fie un întreg de la 1 în sus.');
    }

    if (!parseDecimalCell(draft.length).ok) {
      flag(row.id, 'length');
      messages.push('Lungimea trebuie să fie un număr pozitiv sau goală.');
    }

    if (!parseDecimalCell(draft.weightPerPiece).ok) {
      flag(row.id, 'weightPerPiece');
      messages.push('Greutatea trebuie să fie un număr pozitiv sau goală.');
    }
  }

  if (messages.length > 0) {
    return { ok: false, message: [...new Set(messages)].join(' '), invalid };
  }

  const plan: SavePlan = {
    deletes: assemblies
      .filter((assembly) => removedIds.has(assembly.id))
      .map((assembly) => ({ id: assembly.id, name: assembly.name })),
    updates: [],
    creates: [],
  };

  for (const row of rows) {
    const draft = drafts[row.id];
    if (!draft) {
      continue;
    }

    const name = draft.name.trim();
    const quantity = parseQuantityCell(draft.quantity) as { ok: true; value: number };
    const length = parseDecimalCell(draft.length) as { ok: true; value: number | null };
    const weight = parseDecimalCell(draft.weightPerPiece) as { ok: true; value: number | null };
    const profile = draft.profile.trim() || null;

    if (!row.existing) {
      plan.creates.push({
        id: row.id,
        name,
        input: {
          name,
          quantity: quantity.value,
          profile,
          length: length.value,
          weightPerPiece: weight.value,
        },
      });
      continue;
    }

    const input: UpdateProjectAssemblyInput = {};
    if (name !== row.existing.name) {
      input.name = name;
    }
    if (quantity.value !== row.existing.quantity) {
      input.quantity = quantity.value;
    }
    if (profile !== row.existing.profile) {
      input.profile = profile;
    }
    if (length.value !== row.existing.length) {
      input.length = length.value;
    }
    if (weight.value !== row.existing.weightPerPiece) {
      input.weightPerPiece = weight.value;
    }

    if (Object.keys(input).length > 0) {
      plan.updates.push({ id: row.id, name: row.existing.name, input });
    }
  }

  return { ok: true, plan };
}

/** What an overwrite would cost, worked out from the list already on screen. */
function overwriteImpact(assemblies: ProjectAssemblyDto[], rows: AssemblyImportRowDto[]) {
  const incoming = new Set(rows.map((row) => row.name));
  const removed = assemblies.filter((assembly) => !incoming.has(assembly.name));

  return {
    removed: removed.length,
    removedWithProgress: removed.filter(hasProgress).length,
    kept: assemblies.length - removed.length,
  };
}

function countWithNoun(count: number, singular: string, plural: string): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/** "3 ansamble actualizate, 1 ansamblu adăugat, 2 ansamble șterse" — only the parts that happened. */
function savedSummary(saved: { updated: number; created: number; deleted: number }): string {
  const parts: string[] = [];
  if (saved.updated > 0) {
    parts.push(countWithNoun(saved.updated, 'ansamblu actualizat', 'ansamble actualizate'));
  }
  if (saved.created > 0) {
    parts.push(countWithNoun(saved.created, 'ansamblu adăugat', 'ansamble adăugate'));
  }
  if (saved.deleted > 0) {
    parts.push(countWithNoun(saved.deleted, 'ansamblu șters', 'ansamble șterse'));
  }
  return parts.join(', ');
}

const CELL_INPUT_CLASS =
  'w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const CELL_INPUT_INVALID_CLASS =
  'w-full rounded border border-danger bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-danger';
const ROW_ACTION_CLASS =
  'rounded p-1.5 text-text-muted transition-colors hover:bg-surface-raised disabled:cursor-not-allowed disabled:opacity-30';

export interface AssemblyListScreenProps {
  open: boolean;
  projectId: string;
  projectName: string;
  onClose: () => void;
  /** Open with the table already editable. */
  startInEdit?: boolean;
  /** Adds the "Suprascrie" tab, which replaces the whole list in one go. */
  allowOverwrite?: boolean;
  /** Fired after the list changed on the server, so counts upstream can catch up. */
  onChanged?: () => void;
  /**
   * `progress` splits the list into "De făcut" and "Realizate" with a column
   * per activity, and moves the edit control up into the header. `list` is
   * the plain table with "Editare" in the footer.
   */
  variant?: 'list' | 'progress';
}

/**
 * A project's saved assembly list: read it, edit every field, add or remove
 * marks, or replace it. Edits, additions and removals all stay on screen until
 * "Salvează" — nothing reaches the server row by row.
 */
export function AssemblyListScreen({
  open,
  projectId,
  projectName,
  onClose,
  startInEdit = false,
  allowOverwrite = false,
  onChanged,
  variant = 'list',
}: AssemblyListScreenProps) {
  const { showToast } = useToast();
  const [assemblies, setAssemblies] = useState<ProjectAssemblyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'overwrite' | 'pending' | 'completed'>('list');
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  /** Rows added in this edit session, in the order they were added. */
  const [newIds, setNewIds] = useState<string[]>([]);
  /** Saved rows marked for removal; they go on save, not on click. */
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [invalidCells, setInvalidCells] = useState<Record<string, DraftField[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<AssemblyImportRowDto[] | null>(null);
  const [isOverwriting, setIsOverwriting] = useState(false);
  const newRowCounter = useRef(0);

  const load = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const rows = await listProjectAssemblies(projectId);
      setAssemblies(rows);
      setDrafts(buildDrafts(rows));
      return rows;
    } catch (caught) {
      setAssemblies([]);
      setDrafts({});
      setError(apiErrorToastMessage(caught));
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    if (!open) {
      return;
    }

    setTab(variant === 'progress' ? 'pending' : 'list');
    setEditing(startInEdit);
    setNewIds([]);
    setRemovedIds(new Set());
    setInvalidCells({});
    setPendingRows(null);
    setImportOpen(false);
    void load();
  }, [open, startInEdit, variant, load]);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      // While the import screen is up it owns Escape, and a save in flight
      // should not lose the panel it is writing from.
      if (event.key === 'Escape' && !importOpen && !isSaving && !isOverwriting) {
        onClose();
      }
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open, importOpen, isSaving, isOverwriting, onClose]);

  if (!open) {
    return null;
  }

  const totalPieces = assemblies.reduce((sum, assembly) => sum + assembly.quantity, 0);
  const listWeight = assemblyListWeight(assemblies);
  const isBusy = isSaving || isOverwriting;
  const removedAssemblies = assemblies.filter((assembly) => removedIds.has(assembly.id));
  const removedWithProgress = removedAssemblies.filter(hasProgress).length;
  const isProgress = variant === 'progress';
  const trackedActivities = isProgress ? trackedActivitiesOf(assemblies) : [];
  const completedIds = new Set(
    assemblies
      .filter((assembly) => isAssemblyComplete(assembly, trackedActivities))
      .map((assembly) => assembly.id),
  );
  const pendingCount = assemblies.length - completedIds.size;
  // Editing always works on the whole list; the split is for reading.
  const shownAssemblies =
    editing || !isProgress
      ? assemblies
      : assemblies.filter((assembly) =>
          tab === 'completed' ? completedIds.has(assembly.id) : !completedIds.has(assembly.id),
        );
  const showTabs = allowOverwrite || (isProgress && !editing);

  function updateDraft(id: string, field: DraftField, value: string) {
    setDrafts((current) => ({ ...current, [id]: { ...current[id], [field]: value } }));
    setInvalidCells((current) => {
      if (!current[id]?.includes(field)) {
        return current;
      }
      const next = current[id].filter((entry) => entry !== field);
      return { ...current, [id]: next };
    });
  }

  function resetDrafts() {
    setDrafts(buildDrafts(assemblies));
    setNewIds([]);
    setRemovedIds(new Set());
    setInvalidCells({});
    setError(null);
  }

  function startEditing() {
    resetDrafts();
    setEditing(true);
  }

  function cancelEditing() {
    resetDrafts();
    setEditing(false);
  }

  function addRow() {
    newRowCounter.current += 1;
    const id = `new-${newRowCounter.current}`;
    setDrafts((current) => ({ ...current, [id]: { ...EMPTY_DRAFT } }));
    setNewIds((current) => [...current, id]);
    setError(null);
  }

  function discardNewRow(id: string) {
    setNewIds((current) => current.filter((entry) => entry !== id));
    setDrafts((current) => omitKey(current, id));
    setInvalidCells((current) => omitKey(current, id));
  }

  function toggleRemoved(id: string) {
    setRemovedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
    setInvalidCells((current) => omitKey(current, id));
    setError(null);
  }

  async function handleSave() {
    const validation = validateDrafts(assemblies, drafts, newIds, removedIds);
    if (!validation.ok) {
      setInvalidCells(validation.invalid);
      setError(validation.message);
      return;
    }

    const { plan } = validation;
    const total = plan.deletes.length + plan.updates.length + plan.creates.length;
    if (total === 0) {
      cancelEditing();
      return;
    }

    setIsSaving(true);
    setError(null);
    setInvalidCells({});

    // One request per row, in order: a failure halfway through has to name the
    // mark it stopped on, which a parallel batch cannot do. Removals go first so
    // a mark can be dropped and re-added, or freed up for a rename, in one save.
    const saved = { deleted: 0, updated: 0, created: 0 };
    const doneIds = new Set<string>();
    let failure: string | null = null;

    function describe(name: string, caught: unknown): string {
      const reason =
        caught instanceof ApiError && caught.status === 409
          ? 'există deja un ansamblu cu acest nume în proiect.'
          : apiErrorToastMessage(caught);
      return `„${name}”: ${reason}`;
    }

    for (const change of plan.deletes) {
      try {
        await deleteProjectAssembly(change.id);
        saved.deleted += 1;
        doneIds.add(change.id);
      } catch (caught) {
        failure = describe(change.name, caught);
        break;
      }
    }

    if (!failure) {
      for (const change of plan.updates) {
        try {
          await updateProjectAssembly(change.id, change.input);
          saved.updated += 1;
          doneIds.add(change.id);
        } catch (caught) {
          failure = describe(change.name, caught);
          break;
        }
      }
    }

    if (!failure) {
      for (const change of plan.creates) {
        try {
          await createProjectAssembly(projectId, change.input);
          saved.created += 1;
          doneIds.add(change.id);
        } catch (caught) {
          failure = describe(change.name, caught);
          break;
        }
      }
    }

    await load();
    setIsSaving(false);

    const savedCount = saved.deleted + saved.updated + saved.created;
    if (savedCount > 0) {
      onChanged?.();
    }

    if (failure) {
      // Keep what did not make it, so the admin can fix the one row and save
      // again instead of typing everything back in.
      const pendingIds = [...plan.updates, ...plan.creates]
        .map((change) => change.id)
        .filter((id) => !doneIds.has(id));
      setDrafts((current) => ({
        ...current,
        ...Object.fromEntries(pendingIds.map((id) => [id, drafts[id]])),
      }));
      setNewIds((current) => current.filter((id) => !doneIds.has(id)));
      setRemovedIds(
        new Set(plan.deletes.map((change) => change.id).filter((id) => !doneIds.has(id))),
      );
      setError(
        savedCount > 0 ? `S-au salvat ${savedCount} din ${total}, apoi ${failure}` : failure,
      );
      return;
    }

    setNewIds([]);
    setRemovedIds(new Set());
    setEditing(false);
    showToast(savedSummary(saved), 'success');
  }

  function openOverwriteTab() {
    setTab('overwrite');
    setError(null);
    if (!pendingRows) {
      setImportOpen(true);
    }
  }

  async function handleOverwrite() {
    if (!pendingRows) {
      return;
    }

    setIsOverwriting(true);
    setError(null);

    try {
      const result = await importProjectAssemblies(projectId, {
        rows: pendingRows,
        replace: true,
      });
      const kept = result.created + result.updated;
      showToast(
        result.deleted > 0
          ? `${kept} ansamble salvate, ${result.deleted} șterse`
          : `${kept} ${kept === 1 ? 'ansamblu salvat' : 'ansamble salvate'}`,
        'success',
      );
      setPendingRows(null);
      setEditing(false);
      setNewIds([]);
      setRemovedIds(new Set());
      setTab(isProgress ? 'pending' : 'list');
      await load();
      onChanged?.();
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setIsOverwriting(false);
    }
  }

  const impact = pendingRows ? overwriteImpact(assemblies, pendingRows) : null;

  const tableRows: { id: string; assembly: ProjectAssemblyDto | null }[] = [
    ...shownAssemblies.map((assembly) => ({ id: assembly.id, assembly })),
    ...(editing ? newIds.map((id) => ({ id, assembly: null })) : []),
  ];

  function renderEditableCells(id: string, draft: DraftRow, index: number, autoFocus: boolean) {
    const invalid = invalidCells[id] ?? [];
    const cellClass = (field: DraftField) =>
      invalid.includes(field) ? CELL_INPUT_INVALID_CLASS : CELL_INPUT_CLASS;

    return (
      <>
        <td className="px-3 py-1.5">
          <input
            type="text"
            value={draft.name}
            disabled={isBusy}
            autoFocus={autoFocus}
            aria-label={`Nume ansamblu ${index + 1}`}
            onChange={(event) => updateDraft(id, 'name', event.target.value)}
            className={cellClass('name')}
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            type="text"
            inputMode="numeric"
            value={draft.quantity}
            disabled={isBusy}
            aria-label={`Nr. bucăți ansamblu ${index + 1}`}
            onChange={(event) => updateDraft(id, 'quantity', event.target.value)}
            className={`${cellClass('quantity')} text-right`}
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            type="text"
            value={draft.profile}
            disabled={isBusy}
            aria-label={`Profil ansamblu ${index + 1}`}
            onChange={(event) => updateDraft(id, 'profile', event.target.value)}
            className={cellClass('profile')}
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={draft.length}
            disabled={isBusy}
            aria-label={`Lungime ansamblu ${index + 1}`}
            onChange={(event) => updateDraft(id, 'length', event.target.value)}
            className={`${cellClass('length')} text-right`}
          />
        </td>
        <td className="px-3 py-1.5">
          <input
            type="text"
            inputMode="decimal"
            value={draft.weightPerPiece}
            disabled={isBusy}
            aria-label={`Greutate ansamblu ${index + 1}`}
            onChange={(event) => updateDraft(id, 'weightPerPiece', event.target.value)}
            className={`${cellClass('weightPerPiece')} text-right`}
          />
        </td>
        {trackedActivities.map((activity) => {
          const existing = assemblies.find((assembly) => assembly.id === id);
          const done = existing ? assemblyDoneForActivity(existing, activity.id) : 0;
          return (
            <td
              key={activity.id}
              className="whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums text-text-muted"
            >
              {existing ? `${done} / ${draft.quantity.trim() || '—'}` : '—'}
            </td>
          );
        })}
      </>
    );
  }

  function renderReadOnlyCells(assembly: ProjectAssemblyDto, muted: boolean) {
    const primary = muted ? 'text-text-muted line-through' : 'text-text-primary';
    const secondary = muted ? 'text-text-muted line-through' : 'text-text-secondary';

    return (
      <>
        <td className={`px-3 py-1.5 ${primary}`}>{assembly.name}</td>
        <td className={`px-3 py-1.5 text-right ${primary}`}>{assembly.quantity}</td>
        <td className={`px-3 py-1.5 ${secondary}`}>{assembly.profile ?? '—'}</td>
        <td className={`px-3 py-1.5 text-right ${secondary}`}>{formatNumber(assembly.length)}</td>
        <td className={`px-3 py-1.5 text-right ${secondary}`}>
          {formatNumber(assembly.weightPerPiece)}
        </td>
        {trackedActivities.map((activity) => {
          const done = assemblyDoneForActivity(assembly, activity.id);
          const tone = muted
            ? 'text-text-muted line-through'
            : done >= assembly.quantity
              ? 'text-success-text'
              : done > 0
                ? 'text-text-primary'
                : 'text-text-muted';
          return (
            <td
              key={activity.id}
              className={`whitespace-nowrap px-3 py-1.5 text-right font-mono tabular-nums ${tone}`}
            >
              {done} / {assembly.quantity}
            </td>
          );
        })}
      </>
    );
  }

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4">
        <div className="relative flex max-h-full min-h-[22rem] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-popover">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-medium text-text-primary">Ansamble</h2>
              {projectName && <p className="truncate text-sm text-text-muted">{projectName}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              {isProgress && !editing && (
                <button
                  type="button"
                  aria-label="Editează ansamblele"
                  title="Editează ansamblele"
                  disabled={isBusy || isLoading}
                  onClick={startEditing}
                  className="rounded p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <i className="ti ti-pencil text-lg" aria-hidden="true" />
                </button>
              )}
              <button
                type="button"
                aria-label="Închide"
                disabled={isBusy}
                onClick={onClose}
                className="rounded p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="ti ti-x text-lg" aria-hidden="true" />
              </button>
            </div>
          </div>

          {showTabs && (
            <div className="flex gap-1 border-b border-border-subtle px-6" role="tablist">
              {(isProgress
                ? [
                    { key: 'pending' as const, label: `De făcut (${pendingCount})` },
                    { key: 'completed' as const, label: `Realizate (${completedIds.size})` },
                  ]
                : [
                    { key: 'list' as const, label: 'Ansamble' },
                    { key: 'overwrite' as const, label: 'Suprascrie' },
                  ]
              ).map((entry) => (
                <button
                  key={entry.key}
                  type="button"
                  role="tab"
                  aria-selected={tab === entry.key}
                  disabled={isBusy}
                  onClick={() => {
                    if (entry.key === 'overwrite') {
                      openOverwriteTab();
                      return;
                    }
                    setTab(entry.key);
                    setError(null);
                  }}
                  className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                    tab === entry.key
                      ? 'border-accent text-accent'
                      : 'border-transparent text-text-secondary hover:text-text-primary'
                  }`}
                >
                  {entry.label}
                </button>
              ))}
            </div>
          )}

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-5">
            {tab === 'overwrite' ? (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-text-secondary">
                  Lista nouă înlocuiește complet lista curentă. Ansamblele care nu apar în ea
                  ies din listă, dar orele deja raportate pe ele rămân — sunt muncite și
                  trebuie plătite.
                </p>

                {impact ? (
                  <div className="flex flex-col gap-3 rounded-md border border-border-subtle bg-surface-raised/50 px-4 py-3">
                    <p className="text-sm text-text-primary">
                      Lista nouă are{' '}
                      <span className="font-medium">{pendingRows?.length ?? 0}</span>{' '}
                      {(pendingRows?.length ?? 0) === 1 ? 'ansamblu' : 'ansamble'}.
                    </p>
                    <ul className="flex flex-col gap-1 text-sm text-text-secondary">
                      <li>{impact.kept} se regăsesc în lista curentă și se actualizează.</li>
                      <li className={impact.removed > 0 ? 'text-danger' : undefined}>
                        {impact.removed} din lista curentă lipsesc din ea și ies din listă.
                      </li>
                      {impact.removedWithProgress > 0 && (
                        <li className="text-text-muted">
                          {impact.removedWithProgress} dintre ele au ore raportate — orele
                          rămân în pontaje.
                        </li>
                      )}
                    </ul>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleOverwrite()}
                        className="rounded-md bg-[var(--color-timer-stop)] px-4 py-2 text-sm font-medium text-[var(--color-timer-stop-text)] transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isOverwriting ? 'Se suprascrie…' : 'Suprascrie lista'}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => setImportOpen(true)}
                        className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Alege altă listă
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={onClose}
                        className="rounded-md border border-border px-4 py-2 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Anulează
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => setImportOpen(true)}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-md border border-dashed border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <i className="ti ti-stack-2 text-base" aria-hidden="true" />
                    Alege lista nouă
                  </button>
                )}

                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}
              </div>
            ) : isLoading && assemblies.length === 0 ? (
              <div className="flex h-full min-h-[14rem] items-center justify-center">
                <WeldingLoader label="Se încarcă ansamblele…" />
              </div>
            ) : error && assemblies.length === 0 && !editing ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : !isLoading && assemblies.length === 0 && !editing ? (
              <p className="text-sm text-text-muted">Proiectul nu are încă ansamble.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{assemblies.length}</span>{' '}
                  {assemblies.length === 1 ? 'ansamblu' : 'ansamble'} ·{' '}
                  <span className="font-medium text-text-primary">{totalPieces}</span>{' '}
                  {totalPieces === 1 ? 'bucată' : 'bucăți'}
                  {listWeight.weightKg !== null && (
                    <>
                      {' '}
                      ·{' '}
                      <span className="font-medium text-text-primary">
                        {formatProjectWeight(listWeight.weightKg)}
                      </span>
                    </>
                  )}
                  {listWeight.withoutWeight > 0 && (
                    <span className="text-warning-text">
                      {' '}
                      ·{' '}
                      {listWeight.withoutWeight === 1
                        ? 'un ansamblu fără greutate'
                        : `${listWeight.withoutWeight} ansamble fără greutate`}
                    </span>
                  )}
                </p>

                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}

                {editing && removedAssemblies.length > 0 && (
                  <p className="text-sm text-danger">
                    {countWithNoun(removedAssemblies.length, 'ansamblu iese', 'ansamble ies')}{' '}
                    din listă la salvare.
                    {removedWithProgress > 0 && (
                      <span className="text-text-muted">
                        {' '}
                        {removedWithProgress === 1
                          ? 'Unul dintre ele are'
                          : `${removedWithProgress} dintre ele au`}{' '}
                        ore raportate — orele rămân în pontaje.
                      </span>
                    )}
                  </p>
                )}

                {tableRows.length === 0 && isProgress && !editing && (
                  <p className="text-sm text-text-muted">
                    {tab === 'completed'
                      ? 'Niciun ansamblu nu este încă realizat pe toate activitățile.'
                      : 'Toate ansamblele sunt realizate.'}
                  </p>
                )}

                {tableRows.length > 0 && (
                  <div className="overflow-x-auto overscroll-x-contain rounded-md border border-border-subtle">
                    <table className="w-full min-w-[36rem] border-collapse text-sm">
                      <thead>
                        <tr className="border-b border-border-subtle bg-surface-raised text-left text-xs text-text-secondary">
                          <th className="px-3 py-2 font-medium">Nr. crt.</th>
                          <th className="px-3 py-2 font-medium">Ansamblu</th>
                          <th className="px-3 py-2 text-right font-medium">Nr. bucăți</th>
                          <th className="px-3 py-2 font-medium">Profil</th>
                          <th className="px-3 py-2 text-right font-medium">Lungime</th>
                          <th className="px-3 py-2 text-right font-medium">
                            Greutate (kg/buc.)
                          </th>
                          {trackedActivities.map((activity) => (
                            <th
                              key={activity.id}
                              className="whitespace-nowrap px-3 py-2 text-right font-medium"
                            >
                              <span className="inline-flex items-center gap-1.5">
                                <span
                                  className="size-1.5 shrink-0 rounded-full"
                                  style={{
                                    backgroundColor:
                                      activity.color ?? 'var(--color-border-subtle)',
                                  }}
                                  aria-hidden="true"
                                />
                                {activity.name}
                              </span>
                            </th>
                          ))}
                          {editing && (
                            <th className="w-12 px-2 py-2">
                              <span className="sr-only">Acțiuni</span>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {tableRows.map(({ id, assembly }, index) => {
                          const draft = drafts[id];
                          const removed = assembly !== null && removedIds.has(id);
                          const isNew = assembly === null;

                          return (
                            <tr
                              key={id}
                              className="border-b border-border-subtle last:border-b-0"
                            >
                              <td className="px-3 py-1.5 text-text-muted">{index + 1}</td>
                              {!editing && assembly ? (
                                renderReadOnlyCells(assembly, false)
                              ) : removed && assembly ? (
                                renderReadOnlyCells(assembly, true)
                              ) : draft ? (
                                renderEditableCells(id, draft, index, isNew)
                              ) : null}
                              {editing && (
                                <td className="px-2 py-1.5 text-right">
                                  {isNew ? (
                                    <button
                                      type="button"
                                      aria-label={`Renunță la ansamblul ${index + 1}`}
                                      title="Renunță"
                                      disabled={isBusy}
                                      onClick={() => discardNewRow(id)}
                                      className={`${ROW_ACTION_CLASS} hover:text-danger`}
                                    >
                                      <i className="ti ti-trash text-base" aria-hidden="true" />
                                    </button>
                                  ) : removed ? (
                                    <button
                                      type="button"
                                      aria-label={`Păstrează ansamblul ${index + 1}`}
                                      title="Păstrează"
                                      disabled={isBusy}
                                      onClick={() => toggleRemoved(id)}
                                      className={`${ROW_ACTION_CLASS} hover:text-text-primary`}
                                    >
                                      <i
                                        className="ti ti-arrow-back-up text-base"
                                        aria-hidden="true"
                                      />
                                    </button>
                                  ) : (
                                    <button
                                      type="button"
                                      aria-label={`Șterge ansamblul ${index + 1}`}
                                      title="Șterge"
                                      disabled={isBusy}
                                      onClick={() => toggleRemoved(id)}
                                      className={`${ROW_ACTION_CLASS} hover:text-danger`}
                                    >
                                      <i className="ti ti-trash text-base" aria-hidden="true" />
                                    </button>
                                  )}
                                </td>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}

                {editing && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={addRow}
                    className="inline-flex items-center gap-2 self-start text-sm text-accent transition-opacity hover:opacity-80 disabled:cursor-not-allowed disabled:opacity-40"
                  >
                    <i className="ti ti-plus text-base" aria-hidden="true" />
                    Adaugă ansamblu
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border-subtle px-6 py-4">
            {tab !== 'overwrite' && editing ? (
              <>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleSave()}
                  className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Se salvează…' : 'Salvează'}
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={cancelEditing}
                  className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anulează
                </button>
              </>
            ) : tab !== 'overwrite' && !isProgress ? (
              <>
                <button
                  type="button"
                  disabled={isBusy || isLoading}
                  onClick={startEditing}
                  className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <i className="ti ti-pencil text-base" aria-hidden="true" />
                  Editare
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
                >
                  Închide
                </button>
              </>
            ) : (
              <button
                type="button"
                disabled={isBusy}
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Închide
              </button>
            )}
          </div>

          {isBusy && (
            <div className="absolute inset-0 flex items-center justify-center bg-surface/90 backdrop-blur-[1px]">
              <WeldingLoader
                label={isOverwriting ? 'Se suprascrie lista…' : 'Se salvează modificările…'}
              />
            </div>
          )}
        </div>
      </div>

      <AssemblyImportScreen
        open={importOpen}
        projectName={projectName}
        title="Suprascrie ansamblele"
        confirmLabel={(count) =>
          count === 0 ? 'Folosește lista' : `Folosește lista (${count})`
        }
        onClose={() => {
          setImportOpen(false);
          onClose();
        }}
        onConfirm={(rows) => {
          setPendingRows(rows);
          setImportOpen(false);
          setTab('overwrite');
        }}
      />
    </>
  );
}
