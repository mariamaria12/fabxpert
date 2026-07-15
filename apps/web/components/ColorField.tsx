'use client';

import {
  PROJECT_COLOR_PRESETS,
  type ProjectColorPreset,
} from '@fabxpert/shared';
import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useBusinessAutofillProps } from './inputAutofill';

const HEX_REGEX = /^#[0-9A-Fa-f]{6}$/;
const PICKER_FALLBACK = '#6B6B6B';
const CHECK_ON_LIGHT = '#2B2107';
const CHECK_ON_DARK = 'var(--color-text-primary)';

/** Preset palette — re-exported for existing web imports. */
export const COLOR_PRESETS = PROJECT_COLOR_PRESETS;

export type ColorPreset = ProjectColorPreset;

export interface ColorFieldProps {
  id: string;
  label?: string;
  value: string | null;
  error?: string;
  disabled?: boolean;
  onChange: (value: string | null) => void;
  onDraftInvalidChange?: (invalid: boolean) => void;
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised px-3 py-[10px] text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

const SWATCH_BAND_SCROLL_CLASS =
  'overflow-x-auto rounded-md border border-border-subtle [scrollbar-color:var(--color-border)_transparent] [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent';

function normalizeHex(hex: string): string {
  return hex.toUpperCase();
}

function isPresetColor(color: string): boolean {
  return COLOR_PRESETS.includes(normalizeHex(color) as ColorPreset);
}

function isCustomColor(color: string | null): boolean {
  return color !== null && HEX_REGEX.test(color) && !isPresetColor(color);
}

/** Simple relative luminance — picks readable check icon color on swatches. */
function checkIconColor(hex: string): string {
  const normalized = normalizeHex(hex);
  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? CHECK_ON_LIGHT : CHECK_ON_DARK;
}

interface SwatchButtonProps {
  ariaLabel: string;
  disabled?: boolean;
  selected?: boolean;
  onClick: () => void;
  children?: ReactNode;
  className?: string;
  style?: CSSProperties;
  /** When set, a centered check icon is shown on selection (preset swatches). */
  checkHex?: string;
}

function SwatchButton({
  ariaLabel,
  disabled,
  selected,
  onClick,
  children,
  className = '',
  style,
  checkHex,
}: SwatchButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={ariaLabel}
      aria-pressed={selected}
      onClick={onClick}
      style={style}
      className={`relative flex h-8 min-w-8 shrink-0 items-center justify-center transition-[filter] focus:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface disabled:cursor-not-allowed disabled:opacity-50 ${selected ? 'brightness-110' : ''} ${className}`}
    >
      {children}
      {selected && checkHex && (
        <i
          className="ti ti-check absolute text-xs leading-none"
          style={{ color: checkIconColor(checkHex) }}
          aria-hidden="true"
        />
      )}
    </button>
  );
}

export function ColorField({
  id,
  label = 'Culoare',
  value,
  error,
  disabled,
  onChange,
  onDraftInvalidChange,
}: ColorFieldProps) {
  const pickerId = useId();
  const pickerRef = useRef<HTMLInputElement>(null);
  const businessAutofill = useBusinessAutofillProps();
  const [customOpen, setCustomOpen] = useState(false);
  const [textValue, setTextValue] = useState(value ?? '');

  const customValue = isCustomColor(value);
  const showCustomRow = customOpen || customValue;

  useEffect(() => {
    if (customValue) {
      setCustomOpen(true);
    }
  }, [customValue]);

  useEffect(() => {
    setTextValue(value ?? '');
  }, [value]);

  useEffect(() => {
    if (!showCustomRow) {
      onDraftInvalidChange?.(false);
      return;
    }
    onDraftInvalidChange?.(textValue.length > 0 && !HEX_REGEX.test(textValue));
  }, [textValue, showCustomRow, onDraftInvalidChange]);

  const selectedPreset =
    value !== null && HEX_REGEX.test(value) && isPresetColor(value) ? normalizeHex(value) : null;
  const isNoColorSelected = value === null && !showCustomRow;

  const pickerValue =
    value && HEX_REGEX.test(value) ? normalizeHex(value) : PICKER_FALLBACK;

  function selectPreset(hex: ColorPreset) {
    setCustomOpen(false);
    onChange(hex);
  }

  function selectNoColor() {
    setCustomOpen(false);
    onChange(null);
  }

  function openCustomFlow() {
    setCustomOpen(true);
  }

  function handleTextChange(text: string) {
    setTextValue(text);
    if (HEX_REGEX.test(text)) {
      onChange(normalizeHex(text));
    }
  }

  function handleTextBlur() {
    if (!textValue || !HEX_REGEX.test(textValue)) {
      setTextValue(value ?? '');
    }
  }

  function handlePickerChange(hex: string) {
    const normalized = normalizeHex(hex);
    setTextValue(normalized);
    onChange(normalized);
  }

  return (
    <div>
      <p id={`${id}-label`} className="mb-1.5 block text-xs text-text-secondary">
        {label}
      </p>

      <div className={SWATCH_BAND_SCROLL_CLASS}>
        <div
          role="group"
          aria-labelledby={`${id}-label`}
          className="flex min-w-full flex-nowrap"
        >
          {COLOR_PRESETS.map((hex, index) => (
            <SwatchButton
              key={hex}
              ariaLabel={hex}
              disabled={disabled}
              selected={selectedPreset === hex}
              checkHex={hex}
              onClick={() => selectPreset(hex)}
              style={{ backgroundColor: hex }}
              className={`flex-1${index === 0 ? ' rounded-l-md' : ''}`}
            />
          ))}

          <SwatchButton
            ariaLabel="Fără culoare"
            disabled={disabled}
            selected={isNoColorSelected}
            onClick={selectNoColor}
            className="border-l border-dashed border-border bg-surface"
          >
            {isNoColorSelected ? (
              <i className="ti ti-check text-xs text-text-primary" aria-hidden="true" />
            ) : (
              <i className="ti ti-x text-xs text-text-muted" aria-hidden="true" />
            )}
          </SwatchButton>

          <SwatchButton
            ariaLabel="Culoare personalizată"
            disabled={disabled}
            selected={customValue}
            onClick={openCustomFlow}
            className="rounded-r-md border border-l-0 border-border bg-surface"
          >
            {customValue ? (
              <i className="ti ti-check text-xs text-text-primary" aria-hidden="true" />
            ) : (
              <i className="ti ti-plus text-xs text-text-muted" aria-hidden="true" />
            )}
          </SwatchButton>
        </div>
      </div>

      {showCustomRow && (
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() => pickerRef.current?.click()}
            aria-label="Deschide selectorul de culoare"
            className={`relative size-5 shrink-0 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50${
              customValue ? ' ring-2 ring-text-primary ring-offset-1 ring-offset-surface' : ''
            }`}
            style={{ backgroundColor: pickerValue }}
          />
          <input
            ref={pickerRef}
            id={pickerId}
            type="color"
            value={pickerValue}
            disabled={disabled}
            onChange={(event) => handlePickerChange(event.target.value)}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <input
            id={`${id}-text`}
            type="text"
            value={textValue}
            disabled={disabled}
            placeholder="#RRGGBB"
            onChange={(event) => handleTextChange(event.target.value)}
            onBlur={handleTextBlur}
            className={`${inputClassName} font-mono`}
            {...businessAutofill}
          />
          {customValue && (
            <span className="shrink-0 text-xs text-text-muted">custom</span>
          )}
        </div>
      )}

      <p className="mt-2 text-xs text-text-muted">
        {value === null ? (
          'Selectat: fără culoare'
        ) : (
          <>
            Selectat:{' '}
            <span className="font-mono text-text-secondary">{normalizeHex(value)}</span>
          </>
        )}
      </p>

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}
