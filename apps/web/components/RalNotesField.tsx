'use client';

import { finisajBadgeColors, splitTextByRal } from '@fabxpert/shared';
import type { TextareaHTMLAttributes } from 'react';

/** Shared by the two layers: they only line up while they wrap identically. */
const LAYER_CLASS =
  'm-0 block w-full whitespace-pre-wrap break-words border-0 bg-transparent px-3 py-[10px] text-sm leading-5';

export interface RalNotesFieldProps
  extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'value' | 'onChange' | 'className'> {
  value: string;
  onChange: (value: string) => void;
  /** Lines shown while the note is short; the field grows past that. */
  minRows?: number;
}

/**
 * Notes field where a RAL code takes its colour as soon as it is typed, the
 * way the finish field does. The text stays free text: the code is painted in
 * place, not turned into a separate element, so it is typed, selected and
 * deleted like any other word.
 *
 * Two layers of the same text: the one underneath draws the words and the
 * colours and sets the height, the textarea on top is see-through and only
 * carries the caret and the selection.
 */
export function RalNotesField({
  value,
  onChange,
  minRows = 3,
  disabled,
  ...textareaProps
}: RalNotesFieldProps) {
  return (
    <div
      className={`relative w-full rounded-md border border-border bg-surface-raised focus-within:border-accent focus-within:ring-1 focus-within:ring-accent ${
        disabled ? 'opacity-60' : ''
      }`}
    >
      <div
        aria-hidden="true"
        className={`${LAYER_CLASS} pointer-events-none text-text-primary`}
        style={{ minHeight: `${minRows * 20 + 20}px` }}
      >
        {splitTextByRal(value).map((part, index) => {
          if (part.kind === 'text') {
            return part.text;
          }
          const colors = finisajBadgeColors(part.hex);
          return (
            <span
              key={index}
              className="rounded-[3px]"
              style={{
                backgroundColor: colors.background,
                color: colors.text,
                // Drawn outside the letters, so the code keeps the width it was typed with.
                boxShadow: `0 0 0 2px ${colors.background}${
                  colors.border ? `, 0 0 0 3px ${colors.border}` : ''
                }`,
              }}
            >
              {part.text}
            </span>
          );
        })}
        {/* A trailing line break has no height of its own. */}
        {value.endsWith('\n') ? ' ' : null}
      </div>
      <textarea
        {...textareaProps}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className={`${LAYER_CLASS} absolute inset-0 h-full resize-none overflow-hidden text-transparent caret-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed`}
      />
    </div>
  );
}
