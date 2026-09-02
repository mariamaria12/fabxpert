'use client';

import {
  ApiError,
  listProjectAssemblies,
  importProjectAssemblies,
  updateProjectAssembly,
  type AssemblyImportRowDto,
  type ProjectAssemblyDto,
  type UpdateProjectAssemblyInput,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { WeldingLoader } from '@/components/WeldingLoader';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
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

type RowChange = { id: string; name: string; input: UpdateProjectAssemblyInput };

type ValidationResult =
  | { ok: true; changes: RowChange[] }
  | { ok: false; message: string; invalid: Record<string, DraftField[]> };

/** Everything the drafts have to satisfy before a single request goes out. */
function validateDrafts(
  assemblies: ProjectAssemblyDto[],
  drafts: Record<string, DraftRow>,
): ValidationResult {
  const invalid: Record<string, DraftField[]> = {};
  const messages: string[] = [];
  const seenNames = new Map<string, string>();

  function flag(id: string, field: DraftField) {
    invalid[id] = [...(invalid[id] ?? []), field];
  }

  for (const assembly of assemblies) {
    const draft = drafts[assembly.id];
    if (!draft) {
      continue;
    }

    const name = draft.name.trim();
    if (!name) {
      flag(assembly.id, 'name');
      messages.push('Fiecare ansamblu are nevoie de un nume.');
    } else {
      const key = name.toLocaleLowerCase('ro-RO');
      const duplicateOf = seenNames.get(key);
      if (duplicateOf) {
        flag(assembly.id, 'name');
        messages.push(`Numele „${name}” apare de două ori.`);
      } else {
        seenNames.set(key, assembly.id);
      }
    }

    if (!parseQuantityCell(draft.quantity).ok) {
      flag(assembly.id, 'quantity');
      messages.push('Numărul de bucăți trebuie să fie un întreg de la 1 în sus.');
    }

    if (!parseDecimalCell(draft.length).ok) {
      flag(assembly.id, 'length');
      messages.push('Lungimea trebuie să fie un număr pozitiv sau goală.');
    }

    if (!parseDecimalCell(draft.weightPerPiece).ok) {
      flag(assembly.id, 'weightPerPiece');
      messages.push('Greutatea trebuie să fie un număr pozitiv sau goală.');
    }
  }

  if (messages.length > 0) {
    return { ok: false, message: [...new Set(messages)].join(' '), invalid };
  }

  const changes: RowChange[] = [];
  for (const assembly of assemblies) {
    const draft = drafts[assembly.id];
    if (!draft) {
      continue;
    }

    const name = draft.name.trim();
    const quantity = parseQuantityCell(draft.quantity) as { ok: true; value: number };
    const length = parseDecimalCell(draft.length) as { ok: true; value: number | null };
    const weight = parseDecimalCell(draft.weightPerPiece) as { ok: true; value: number | null };
    const profile = draft.profile.trim() || null;

    const input: UpdateProjectAssemblyInput = {};
    if (name !== assembly.name) {
      input.name = name;
    }
    if (quantity.value !== assembly.quantity) {
      input.quantity = quantity.value;
    }
    if (profile !== assembly.profile) {
      input.profile = profile;
    }
    if (length.value !== assembly.length) {
      input.length = length.value;
    }
    if (weight.value !== assembly.weightPerPiece) {
      input.weightPerPiece = weight.value;
    }

    if (Object.keys(input).length > 0) {
      changes.push({ id: assembly.id, name: assembly.name, input });
    }
  }

  return { ok: true, changes };
}

/** What an overwrite would cost, worked out from the list already on screen. */
function overwriteImpact(assemblies: ProjectAssemblyDto[], rows: AssemblyImportRowDto[]) {
  const incoming = new Set(rows.map((row) => row.name));
  const removed = assemblies.filter((assembly) => !incoming.has(assembly.name));

  return {
    removed: removed.length,
    removedWithProgress: removed.filter((assembly) =>
      assembly.progress.some((entry) => entry.quantityDone > 0),
    ).length,
    kept: assemblies.length - removed.length,
  };
}

const CELL_INPUT_CLASS =
  'w-full rounded border border-border bg-surface px-2 py-1 text-sm text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';
const CELL_INPUT_INVALID_CLASS =
  'w-full rounded border border-danger bg-surface px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-1 focus:ring-danger';

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
}

/** A project's saved assembly list: read it, edit every field, or replace it. */
export function AssemblyListScreen({
  open,
  projectId,
  projectName,
  onClose,
  startInEdit = false,
  allowOverwrite = false,
  onChanged,
}: AssemblyListScreenProps) {
  const { showToast } = useToast();
  const [assemblies, setAssemblies] = useState<ProjectAssemblyDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'list' | 'overwrite'>('list');
  const [editing, setEditing] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, DraftRow>>({});
  const [invalidCells, setInvalidCells] = useState<Record<string, DraftField[]>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [pendingRows, setPendingRows] = useState<AssemblyImportRowDto[] | null>(null);
  const [isOverwriting, setIsOverwriting] = useState(false);

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

    setTab('list');
    setEditing(startInEdit);
    setInvalidCells({});
    setPendingRows(null);
    setImportOpen(false);
    void load();
  }, [open, startInEdit, load]);

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
  const isBusy = isSaving || isOverwriting;

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

  function startEditing() {
    setDrafts(buildDrafts(assemblies));
    setInvalidCells({});
    setError(null);
    setEditing(true);
  }

  function cancelEditing() {
    setDrafts(buildDrafts(assemblies));
    setInvalidCells({});
    setError(null);
    setEditing(false);
  }

  async function handleSave() {
    const validation = validateDrafts(assemblies, drafts);
    if (!validation.ok) {
      setInvalidCells(validation.invalid);
      setError(validation.message);
      return;
    }

    if (validation.changes.length === 0) {
      setEditing(false);
      setError(null);
      return;
    }

    setIsSaving(true);
    setError(null);
    setInvalidCells({});

    // One request per changed row, in order: a failure halfway through has to
    // name the mark it stopped on, which a parallel batch cannot do.
    let saved = 0;
    let failure: string | null = null;
    for (const change of validation.changes) {
      try {
        await updateProjectAssembly(change.id, change.input);
        saved += 1;
      } catch (caught) {
        const reason =
          caught instanceof ApiError && caught.status === 409
            ? 'există deja un ansamblu cu acest nume în proiect.'
            : apiErrorToastMessage(caught);
        failure = `„${change.name}”: ${reason}`;
        break;
      }
    }

    await load();
    setIsSaving(false);

    if (failure) {
      setError(
        saved > 0
          ? `S-au salvat ${saved} din ${validation.changes.length}, apoi ${failure}`
          : failure,
      );
      return;
    }

    setEditing(false);
    showToast(
      `${saved} ${saved === 1 ? 'ansamblu actualizat' : 'ansamble actualizate'}`,
      'success',
    );
    onChanged?.();
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
      setTab('list');
      await load();
      onChanged?.();
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setIsOverwriting(false);
    }
  }

  const impact = pendingRows ? overwriteImpact(assemblies, pendingRows) : null;

  return (
    <>
      <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
        <div className="relative flex max-h-full min-h-[22rem] w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-popover">
          <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
            <div className="min-w-0">
              <h2 className="text-base font-medium text-text-primary">Ansamble</h2>
              {projectName && <p className="truncate text-sm text-text-muted">{projectName}</p>}
            </div>
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

          {allowOverwrite && (
            <div className="flex gap-1 border-b border-border-subtle px-6" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'list'}
                disabled={isBusy}
                onClick={() => {
                  setTab('list');
                  setError(null);
                }}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  tab === 'list'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Ansamble
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'overwrite'}
                disabled={isBusy}
                onClick={openOverwriteTab}
                className={`-mb-px border-b-2 px-3 py-2.5 text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                  tab === 'overwrite'
                    ? 'border-accent text-accent'
                    : 'border-transparent text-text-secondary hover:text-text-primary'
                }`}
              >
                Suprascrie
              </button>
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
            ) : error && assemblies.length === 0 ? (
              <p role="alert" className="text-sm text-danger">
                {error}
              </p>
            ) : !isLoading && assemblies.length === 0 ? (
              <p className="text-sm text-text-muted">Proiectul nu are încă ansamble.</p>
            ) : (
              <div className="flex flex-col gap-4">
                <p className="text-sm text-text-secondary">
                  <span className="font-medium text-text-primary">{assemblies.length}</span>{' '}
                  {assemblies.length === 1 ? 'ansamblu' : 'ansamble'} ·{' '}
                  <span className="font-medium text-text-primary">{totalPieces}</span>{' '}
                  {totalPieces === 1 ? 'bucată' : 'bucăți'}
                </p>

                {error && (
                  <p role="alert" className="text-sm text-danger">
                    {error}
                  </p>
                )}

                {assemblies.length > 0 && (
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
                        </tr>
                      </thead>
                      <tbody>
                        {assemblies.map((assembly, index) => {
                          const draft = drafts[assembly.id];
                          const invalid = invalidCells[assembly.id] ?? [];
                          const cellClass = (field: DraftField) =>
                            invalid.includes(field)
                              ? CELL_INPUT_INVALID_CLASS
                              : CELL_INPUT_CLASS;

                          return (
                            <tr
                              key={assembly.id}
                              className="border-b border-border-subtle last:border-b-0"
                            >
                              <td className="px-3 py-1.5 text-text-muted">{index + 1}</td>
                              {editing && draft ? (
                                <>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="text"
                                      value={draft.name}
                                      disabled={isBusy}
                                      aria-label={`Nume ansamblu ${index + 1}`}
                                      onChange={(event) =>
                                        updateDraft(assembly.id, 'name', event.target.value)
                                      }
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
                                      onChange={(event) =>
                                        updateDraft(assembly.id, 'quantity', event.target.value)
                                      }
                                      className={`${cellClass('quantity')} text-right`}
                                    />
                                  </td>
                                  <td className="px-3 py-1.5">
                                    <input
                                      type="text"
                                      value={draft.profile}
                                      disabled={isBusy}
                                      aria-label={`Profil ansamblu ${index + 1}`}
                                      onChange={(event) =>
                                        updateDraft(assembly.id, 'profile', event.target.value)
                                      }
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
                                      onChange={(event) =>
                                        updateDraft(assembly.id, 'length', event.target.value)
                                      }
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
                                      onChange={(event) =>
                                        updateDraft(
                                          assembly.id,
                                          'weightPerPiece',
                                          event.target.value,
                                        )
                                      }
                                      className={`${cellClass('weightPerPiece')} text-right`}
                                    />
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="px-3 py-1.5 text-text-primary">
                                    {assembly.name}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-text-primary">
                                    {assembly.quantity}
                                  </td>
                                  <td className="px-3 py-1.5 text-text-secondary">
                                    {assembly.profile ?? '—'}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-text-secondary">
                                    {formatNumber(assembly.length)}
                                  </td>
                                  <td className="px-3 py-1.5 text-right text-text-secondary">
                                    {formatNumber(assembly.weightPerPiece)}
                                  </td>
                                </>
                              )}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border-subtle px-6 py-4">
            {tab === 'list' && editing ? (
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
            ) : tab === 'list' ? (
              <>
                <button
                  type="button"
                  disabled={isBusy || isLoading || assemblies.length === 0}
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
