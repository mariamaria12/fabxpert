'use client';

import {
  previewAssembliesFromFile,
  type AssemblyImportIssue,
  type AssemblyImportIssueCode,
  type AssemblyImportRowDto,
  type AssemblyPartsDto,
  type AssemblyPreviewDto,
} from '@fabxpert/shared';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { ProjectComplexityBadge } from '@/components/ProjectComplexityBadge';
import { WeldingLoader } from '@/components/WeldingLoader';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { formatWorkbookParts } from '@/utils/projectComplexity';

const ISSUE_LABELS: Record<AssemblyImportIssueCode, string> = {
  NO_HEADER_ROW: 'Nu am găsit rândul de antet — am citit coloanele în ordine.',
  MISSING_NAME: 'Rând fără nume de ansamblu — nu a fost preluat.',
  INVALID_QUANTITY: 'Număr de bucăți necitibil — a fost pus 1.',
  INVALID_LENGTH: 'Lungime necitibilă — a rămas goală.',
  INVALID_WEIGHT: 'Greutate necitibilă — a rămas goală.',
  DUPLICATE_NAME: 'Ansamblu repetat — a rămas ultima variantă.',
  QUANTITY_BELOW_PROGRESS: 'Sunt raportate mai multe bucăți făcute decât are lista acum.',
};

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

/** One row of the manual entry table, kept as typed until the preview. */
type ManualRow = {
  key: number;
  name: string;
  quantity: string;
  profile: string;
  length: string;
  weightPerPiece: string;
};

function emptyManualRow(key: number): ManualRow {
  return { key, name: '', quantity: '1', profile: '', length: '', weightPerPiece: '' };
}

/** Accepts a decimal comma as well as a point. Undefined when unreadable. */
function parseDecimal(raw: string): number | null | undefined {
  const trimmed = raw.trim();
  if (trimmed === '') {
    return null;
  }
  const value = Number(trimmed.replace(',', '.'));
  return Number.isFinite(value) && value >= 0 ? value : undefined;
}

/**
 * Turns the typed rows into the same preview the file import produces, with
 * the same flags: blank rows are dropped, unreadable cells are flagged and
 * left empty, and a repeated name keeps its last row.
 */
function previewManualRows(manualRows: ManualRow[]): AssemblyPreviewDto {
  const issues: AssemblyImportIssue[] = [];
  const byName = new Map<string, AssemblyImportRowDto>();

  manualRows.forEach((manual, index) => {
    const row = index + 1;
    const name = manual.name.trim();
    if (name === '') {
      return;
    }

    let quantity = Number(manual.quantity.trim());
    if (!Number.isInteger(quantity) || quantity < 1) {
      issues.push({ row, name, code: 'INVALID_QUANTITY', value: manual.quantity });
      quantity = 1;
    }

    let length = parseDecimal(manual.length);
    if (length === undefined) {
      issues.push({ row, name, code: 'INVALID_LENGTH', value: manual.length });
      length = null;
    }

    let weightPerPiece = parseDecimal(manual.weightPerPiece);
    if (weightPerPiece === undefined) {
      issues.push({ row, name, code: 'INVALID_WEIGHT', value: manual.weightPerPiece });
      weightPerPiece = null;
    }

    if (byName.has(name)) {
      issues.push({ row, name, code: 'DUPLICATE_NAME', value: null });
      byName.delete(name);
    }
    byName.set(name, {
      row,
      name,
      quantity,
      profile: manual.profile.trim() || null,
      length,
      weightPerPiece,
    });
  });

  return {
    sheets: [],
    sheetName: null,
    rows: [...byName.values()],
    issues,
    hasHeaderRow: true,
    parts: null,
  };
}

export interface AssemblyImportScreenProps {
  open: boolean;
  projectName: string;
  onClose: () => void;
  /** `parts` is the workbook's parts count, when the file had one to read. */
  onConfirm: (rows: AssemblyImportRowDto[], parts: AssemblyPartsDto | null) => void;
  /** Heading, when the list is being read for something other than adding. */
  title?: string;
  /** Confirm button copy, for the same reason. Gets the row count. */
  confirmLabel?: (rowCount: number) => string;
}

export function AssemblyImportScreen({
  open,
  projectName,
  onClose,
  onConfirm,
  title = 'Adaugă ansamble',
  confirmLabel,
}: AssemblyImportScreenProps) {
  const [manualRows, setManualRows] = useState<ManualRow[]>(() => [emptyManualRow(0)]);
  const nextRowKey = useRef(1);
  const [file, setFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [preview, setPreview] = useState<AssemblyPreviewDto | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSheetPicker, setShowSheetPicker] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !isLoading) {
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
  }, [open, isLoading, onClose]);

  if (!open) {
    return null;
  }

  const hasManualRows = manualRows.some((row) => row.name.trim() !== '');
  const canLoad = (file !== null || hasManualRows) && !isLoading;

  function updateManualRow(key: number, field: Exclude<keyof ManualRow, 'key'>, value: string) {
    setManualRows((rows) => rows.map((row) => (row.key === key ? { ...row, [field]: value } : row)));
    setError(null);
  }

  function addManualRow() {
    setManualRows((rows) => [...rows, emptyManualRow(nextRowKey.current++)]);
  }

  function removeManualRow(key: number) {
    setManualRows((rows) =>
      rows.length === 1 ? [emptyManualRow(nextRowKey.current++)] : rows.filter((row) => row.key !== key),
    );
  }

  async function runPreview(sheet?: string) {
    setIsLoading(true);
    setError(null);
    setShowSheetPicker(false);

    try {
      // The file wins when both are filled; the table is disabled meanwhile.
      const result = file
        ? await previewAssembliesFromFile(file, sheet)
        : previewManualRows(manualRows);

      setPreview(result);
      if (result.rows.length === 0 && result.sheetName !== null) {
        setError('Nu am găsit niciun ansamblu în foaia aleasă.');
      }
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setIsLoading(false);
    }
  }

  function acceptFile(candidate: File | undefined) {
    if (!candidate) {
      return;
    }
    if (!/\.xlsx$/i.test(candidate.name)) {
      setError('Doar fișiere .xlsx pot fi citite.');
      return;
    }
    setError(null);
    setFile(candidate);
    setPreview(null);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    if (isLoading) {
      return;
    }
    acceptFile(event.dataTransfer.files[0]);
  }

  function resetToInput() {
    setPreview(null);
    setError(null);
  }

  const needsSheetChoice =
    preview !== null && preview.sheetName === null && preview.sheets.length > 0;

  // Only rendered when the workbook has no ANSAMBLE sheet, or when the admin
  // asks for the list. Showing twenty-odd tab names next to a list that was
  // found correctly is noise, not a choice.
  const sheetButtons = preview?.sheets.map((sheet) => (
    <button
      key={sheet}
      type="button"
      disabled={isLoading}
      onClick={() => void runPreview(sheet)}
      className={`rounded-md border px-2.5 py-1 text-xs transition-colors disabled:opacity-40 ${
        sheet === preview.sheetName
          ? 'border-accent bg-accent/10 text-accent'
          : 'border-border text-text-secondary hover:border-border-strong hover:text-text-primary'
      }`}
    >
      {sheet}
    </button>
  ));

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-scrim p-4">
      <div className="relative flex max-h-full w-full max-w-5xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-popover">
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle px-6 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-medium text-text-primary">{title}</h2>
            {projectName && (
              <p className="truncate text-sm text-text-muted">{projectName}</p>
            )}
          </div>
          <button
            type="button"
            aria-label="Închide"
            disabled={isLoading}
            onClick={onClose}
            className="rounded p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
          >
            <i className="ti ti-x text-lg" aria-hidden="true" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          {preview === null ? (
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">Adaugă manual</span>
                <div className="overflow-x-auto rounded-md border border-border-subtle">
                  <table className="w-full min-w-[40rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-raised text-left text-xs text-text-secondary">
                        <th className="px-2 py-2 font-medium">Ansamblu</th>
                        <th className="w-24 px-2 py-2 text-right font-medium">Nr. bucăți</th>
                        <th className="px-2 py-2 font-medium">Profil</th>
                        <th className="w-28 px-2 py-2 text-right font-medium">Lungime</th>
                        <th className="w-36 px-2 py-2 text-right font-medium">Greutate (kg/buc.)</th>
                        <th className="w-10 px-2 py-2" aria-label="Acțiuni" />
                      </tr>
                    </thead>
                    <tbody>
                      {manualRows.map((row, index) => (
                        <tr key={row.key} className="border-b border-border-subtle last:border-b-0">
                          <td className="px-2 py-1.5">
                            <input
                              aria-label={`Ansamblu, rândul ${index + 1}`}
                              value={row.name}
                              disabled={isLoading || file !== null}
                              placeholder="GBAL/1"
                              onChange={(event) => updateManualRow(row.key, 'name', event.target.value)}
                              className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              aria-label={`Nr. bucăți, rândul ${index + 1}`}
                              inputMode="numeric"
                              value={row.quantity}
                              disabled={isLoading || file !== null}
                              onChange={(event) => updateManualRow(row.key, 'quantity', event.target.value)}
                              className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              aria-label={`Profil, rândul ${index + 1}`}
                              value={row.profile}
                              disabled={isLoading || file !== null}
                              placeholder="HEA200"
                              onChange={(event) => updateManualRow(row.key, 'profile', event.target.value)}
                              className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              aria-label={`Lungime, rândul ${index + 1}`}
                              inputMode="decimal"
                              value={row.length}
                              disabled={isLoading || file !== null}
                              onChange={(event) => updateManualRow(row.key, 'length', event.target.value)}
                              className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              aria-label={`Greutate, rândul ${index + 1}`}
                              inputMode="decimal"
                              value={row.weightPerPiece}
                              disabled={isLoading || file !== null}
                              onChange={(event) =>
                                updateManualRow(row.key, 'weightPerPiece', event.target.value)
                              }
                              className="w-full rounded-md border border-border bg-surface-raised px-2 py-1.5 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50 text-right"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center">
                            <button
                              type="button"
                              aria-label={`Șterge rândul ${index + 1}`}
                              disabled={isLoading || file !== null}
                              onClick={() => removeManualRow(row.key)}
                              className="rounded p-1 text-text-muted transition-colors hover:bg-surface-raised hover:text-danger disabled:opacity-40"
                            >
                              <i className="ti ti-trash text-base" aria-hidden="true" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  disabled={isLoading || file !== null}
                  onClick={addManualRow}
                  className="flex items-center gap-1 self-start text-sm text-accent disabled:opacity-40"
                >
                  <i className="ti ti-plus" aria-hidden="true" />
                  Adaugă rând
                </button>
                {file !== null && (
                  <p className="text-xs text-text-muted">
                    Fișierul are prioritate — elimină-l ca să adaugi ansamblele manual.
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-sm text-text-secondary">sau încarcă fișierul</span>
                <div
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={handleDrop}
                  className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-6 py-10 transition-colors ${
                    isDragging
                      ? 'border-accent bg-accent/5'
                      : 'border-border bg-surface-raised/40'
                  }`}
                >
                  <i className="ti ti-file-spreadsheet text-2xl text-text-muted" aria-hidden="true" />
                  {file ? (
                    <>
                      <p className="text-sm text-text-primary">{file.name}</p>
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => setFile(null)}
                        className="text-xs text-text-muted underline underline-offset-2 hover:text-text-primary disabled:opacity-40"
                      >
                        Elimină fișierul
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm text-text-secondary">
                        Trage fișierul aici sau{' '}
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => fileInputRef.current?.click()}
                          className="text-accent underline underline-offset-2 disabled:opacity-40"
                        >
                          alege de pe disc
                        </button>
                      </p>
                      <p className="text-xs text-text-muted">Doar .xlsx</p>
                    </>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx"
                    className="hidden"
                    onChange={(event) => acceptFile(event.target.files?.[0])}
                  />
                </div>
              </div>

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
              {needsSheetChoice ? (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-text-secondary">
                    Fișierul nu are o foaie numită „ANSAMBLE”. Alege foaia cu lista:
                  </p>
                  <div className="flex flex-wrap gap-2">{sheetButtons}</div>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <p className="text-sm text-text-secondary">
                    <span className="font-medium text-text-primary">{preview.rows.length}</span>{' '}
                    {preview.rows.length === 1 ? 'ansamblu' : 'ansamble'}
                    {preview.sheetName && <> din foaia „{preview.sheetName}”</>}
                    {preview.sheets.length > 1 && (
                      <>
                        {' · '}
                        <button
                          type="button"
                          disabled={isLoading}
                          onClick={() => setShowSheetPicker((open) => !open)}
                          className="text-text-muted underline underline-offset-2 hover:text-text-primary disabled:opacity-40"
                        >
                          {showSheetPicker ? 'ascunde foile' : 'alege altă foaie'}
                        </button>
                      </>
                    )}
                  </p>
                  {showSheetPicker && <div className="flex flex-wrap gap-2">{sheetButtons}</div>}
                  {preview.parts && (
                    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-text-muted">
                      <ProjectComplexityBadge piecesPerTon={preview.parts.piecesPerTon} showValue />
                      <span>{formatWorkbookParts(preview.parts)}</span>
                    </p>
                  )}
                </div>
              )}

              {preview.issues.length > 0 && (
                <ul className="flex flex-col gap-1 rounded-md border border-border-subtle bg-surface-raised/50 px-3 py-2">
                  {preview.issues.slice(0, 8).map((issue, index) => (
                    <li key={`${issue.code}-${issue.row}-${index}`} className="text-xs text-text-secondary">
                      {issue.row > 0 && <span className="text-text-muted">rând {issue.row}: </span>}
                      {issue.name && <span className="text-text-primary">{issue.name} — </span>}
                      {ISSUE_LABELS[issue.code]}
                    </li>
                  ))}
                  {preview.issues.length > 8 && (
                    <li className="text-xs text-text-muted">
                      și încă {preview.issues.length - 8}
                    </li>
                  )}
                </ul>
              )}

              {error && (
                <p role="alert" className="text-sm text-danger">
                  {error}
                </p>
              )}

              {preview.rows.length > 0 && (
                <div className="overflow-x-auto rounded-md border border-border-subtle">
                  <table className="w-full min-w-[36rem] border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-border-subtle bg-surface-raised text-left text-xs text-text-secondary">
                        <th className="px-3 py-2 font-medium">Nr. crt.</th>
                        <th className="px-3 py-2 font-medium">Ansamblu</th>
                        <th className="px-3 py-2 text-right font-medium">Nr. bucăți</th>
                        <th className="px-3 py-2 font-medium">Profil</th>
                        <th className="px-3 py-2 text-right font-medium">Lungime</th>
                        <th className="px-3 py-2 text-right font-medium">Greutate (kg/buc.)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.rows.map((row, index) => (
                        <tr
                          key={row.name}
                          className="border-b border-border-subtle last:border-b-0"
                        >
                          <td className="px-3 py-1.5 text-text-muted">{index + 1}</td>
                          <td className="px-3 py-1.5 text-text-primary">{row.name}</td>
                          <td className="px-3 py-1.5 text-right text-text-primary">{row.quantity}</td>
                          <td className="px-3 py-1.5 text-text-secondary">{row.profile ?? '—'}</td>
                          <td className="px-3 py-1.5 text-right text-text-secondary">
                            {formatNumber(row.length)}
                          </td>
                          <td className="px-3 py-1.5 text-right text-text-secondary">
                            {formatNumber(row.weightPerPiece)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-border-subtle px-6 py-4">
          {preview === null ? (
            <>
              <button
                type="button"
                disabled={!canLoad}
                onClick={() => void runPreview()}
                className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
              >
                Continuă
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={onClose}
                className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Anulează
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                disabled={isLoading || preview.rows.length === 0}
                onClick={() => onConfirm(preview.rows, preview.parts)}
                className="rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirmLabel
                  ? confirmLabel(preview.rows.length)
                  : preview.rows.length === 0
                    ? 'Adaugă ansamblele'
                    : `Adaugă ${preview.rows.length} ${preview.rows.length === 1 ? 'ansamblu' : 'ansamble'}`}
              </button>
              <button
                type="button"
                disabled={isLoading}
                onClick={resetToInput}
                className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Înapoi
              </button>
            </>
          )}
        </div>

        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-surface/90 backdrop-blur-[1px]">
            <WeldingLoader label="Se citește lista de ansamble…" />
          </div>
        )}
      </div>
    </div>
  );
}
