import { RAL_CLASSIC_COLORS } from './ralClassic';

/** "RAL 7033", "RAL7033", "ral 7033" — the spellings users actually type. */
const RAL_PATTERN = /RAL\s?(\d{4})/i;

/** Luminance at or above this reads better with dark text on top. */
const LIGHT_TEXT_THRESHOLD = 0.5;

/** Very light / very dark fills need an outline so the badge keeps its edges. */
const NEEDS_BORDER_LIGHT = 0.85;
const NEEDS_BORDER_DARK = 0.08;

export type FinisajParts =
  | {
      kind: 'ral';
      /** Four-digit code, e.g. "7033". */
      code: string;
      /** Always formatted "RAL 7033", whatever the user typed. */
      label: string;
      hex: string;
      /** The rest of the value, e.g. "ZINCARE" in "ZINCARE_RAL9002" (null if none). */
      action: string | null;
    }
  | {
      kind: 'plain';
      /** Display-normalised text, e.g. "Zincare". */
      label: string;
    };

function normalizeSeparators(value: string): string {
  return value.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** "ZINCARE" → "Zincare", "vopsire electrostatica" → "Vopsire electrostatica". */
export function formatFinisajLabel(value: string): string {
  const cleaned = normalizeSeparators(value);
  if (!cleaned) {
    return '';
  }
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1).toLowerCase();
}

/**
 * Splits a finisaj value into a RAL colour (when the code exists in RAL Classic)
 * plus the leftover action text. Unknown codes fall back to plain text, so
 * "RAL 1234" renders as an outline badge instead of crashing.
 */
export function parseFinisaj(value: string | null | undefined): FinisajParts | null {
  if (!value || !value.trim()) {
    return null;
  }

  const match = RAL_PATTERN.exec(value);
  const color = match ? RAL_CLASSIC_COLORS[match[1]] : undefined;

  if (!match || !color) {
    // An unknown RAL code keeps the user's exact text; free-form finishes get
    // their capitalisation normalised for display only.
    return {
      kind: 'plain',
      label: match ? normalizeSeparators(value) : formatFinisajLabel(value),
    };
  }

  const action = normalizeSeparators(
    value.slice(0, match.index) + value.slice(match.index + match[0].length),
  );

  return {
    kind: 'ral',
    code: color.code,
    label: `RAL ${color.code}`,
    hex: color.hex,
    action: action ? formatFinisajLabel(action) : null,
  };
}

/** WCAG relative luminance, 0 (black) → 1 (white). */
export function relativeLuminance(hex: string): number {
  const normalized = hex.replace('#', '');
  const toLinear = (channel: number) => {
    const value = channel / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };

  const r = toLinear(Number.parseInt(normalized.slice(0, 2), 16));
  const g = toLinear(Number.parseInt(normalized.slice(2, 4), 16));
  const b = toLinear(Number.parseInt(normalized.slice(4, 6), 16));

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export type RalBadgeColors = {
  background: string;
  /** Near-black or near-white, whichever stays readable on the fill. */
  text: string;
  /** Set only for fills that would otherwise blend into the page. */
  border: string | null;
};

/** Text and outline for a RAL fill — identical maths on web and mobile. */
export function ralBadgeColors(hex: string): RalBadgeColors {
  const luminance = relativeLuminance(hex);

  return {
    background: hex,
    text: luminance >= LIGHT_TEXT_THRESHOLD ? '#1A1A1A' : '#F5F5F5',
    border:
      luminance >= NEEDS_BORDER_LIGHT
        ? 'rgba(0, 0, 0, 0.28)'
        : luminance <= NEEDS_BORDER_DARK
          ? 'rgba(255, 255, 255, 0.28)'
          : null,
  };
}
