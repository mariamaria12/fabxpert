import { parseWorkDateString, workDateToDayKey } from './workDate';

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DISPLAY_DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

function isoPartsToDisplay(year: string, month: string, day: string): string {
  return `${day.padStart(2, '0')}/${month.padStart(2, '0')}/${year}`;
}

/** Calendar date as `dd/mm/yyyy` (display / user input). */
export function formatDateDisplay(iso: string): string {
  const trimmed = iso.trim();
  const datePart = trimmed.slice(0, 10);
  const isoMatch = ISO_DATE_PATTERN.exec(datePart);

  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return isoPartsToDisplay(year, month, day);
  }

  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return isoPartsToDisplay(
    String(date.getFullYear()),
    String(date.getMonth() + 1),
    String(date.getDate()),
  );
}

export function isoToDateDisplay(iso: string | null | undefined): string {
  if (!iso) {
    return '';
  }

  return formatDateDisplay(iso);
}

export function todayDateDisplayValue(reference = new Date()): string {
  return formatDateDisplay(workDateToDayKey(reference));
}

/** `dd/mm/yyyy` or `yyyy-MM-dd` → `yyyy-MM-dd`, or `null` when invalid. */
export function parseDateDisplay(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (ISO_DATE_PATTERN.test(trimmed)) {
    try {
      parseWorkDateString(trimmed);
      return trimmed;
    } catch {
      return null;
    }
  }

  const displayMatch = DISPLAY_DATE_PATTERN.exec(trimmed);
  if (!displayMatch) {
    return null;
  }

  const day = Number.parseInt(displayMatch[1], 10);
  const month = Number.parseInt(displayMatch[2], 10);
  const year = Number.parseInt(displayMatch[3], 10);

  if (month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const iso = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  try {
    parseWorkDateString(iso);
    return iso;
  } catch {
    return null;
  }
}

/** Keeps digits only and inserts `/` while typing (`dd/mm/yyyy`). */
export function formatDateDisplayDraft(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 8);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

export function isCompleteDateDisplay(value: string): boolean {
  return DISPLAY_DATE_PATTERN.test(value.trim());
}
