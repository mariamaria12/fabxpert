'use client';

import { joinFinisaj, splitFinisaj, takeCompletedFinisaj } from '@fabxpert/shared';
import { useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { FinisajBadge } from './FinisajBadge';
import { FORM_LABEL_CLASS } from './formFieldStyles';
import { getBusinessInputAutofillProps } from './inputAutofill';

export interface FinisajFieldProps {
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  maxLength?: number;
  disabled?: boolean;
  onChange: (value: string) => void;
}

/**
 * Finish input that shows what the cards will show: a RAL code turns into its
 * coloured badge the moment it is complete, other finishes on Enter, comma or
 * when the field is left. Backspace on an empty input reopens the last badge.
 */
export function FinisajField({
  id,
  label,
  value,
  placeholder,
  maxLength,
  disabled = false,
  onChange,
}: FinisajFieldProps) {
  const autofillProps = getBusinessInputAutofillProps(useId());
  const [segments, setSegments] = useState<string[]>(() => splitFinisaj(value));
  const [draft, setDraft] = useState('');
  // An untouched finish keeps its exact spelling: the value is only rewritten
  // when the user edits it here, and a value set from outside is read again.
  const emitted = useRef(value);

  useEffect(() => {
    if (value !== emitted.current) {
      emitted.current = value;
      setSegments(splitFinisaj(value));
      setDraft('');
    }
  }, [value]);

  function apply(nextSegments: string[], nextDraft: string) {
    const nextValue = joinFinisaj([...nextSegments, nextDraft]);
    if (maxLength !== undefined && nextValue.length > maxLength && nextValue.length > value.length) {
      return;
    }

    setSegments(nextSegments);
    setDraft(nextDraft);
    emitted.current = nextValue;
    onChange(nextValue);
  }

  function handleDraftChange(text: string) {
    const { completed, rest } = takeCompletedFinisaj(text);
    apply([...segments, ...completed], rest);
  }

  function commitDraft() {
    if (draft.trim()) {
      apply([...segments, ...splitFinisaj(draft)], '');
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if ((event.key === 'Enter' || event.key === ',') && draft.trim()) {
      event.preventDefault();
      commitDraft();
    } else if (event.key === 'Backspace' && draft === '' && segments.length > 0) {
      event.preventDefault();
      apply(segments.slice(0, -1), segments[segments.length - 1]);
    }
  }

  return (
    <div>
      <label htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
      </label>
      <div
        className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-surface-raised px-3 py-2 text-sm focus-within:border-accent focus-within:ring-1 focus-within:ring-accent ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        {segments.map((segment, index) => (
          <span key={`${segment}-${index}`} className="inline-flex min-w-0 items-center gap-0.5">
            <FinisajBadge value={segment} />
            <button
              type="button"
              disabled={disabled}
              aria-label={`Șterge ${segment}`}
              title="Șterge"
              onClick={() =>
                apply(
                  segments.filter((_, position) => position !== index),
                  draft,
                )
              }
              className="rounded p-0.5 text-text-muted transition-colors hover:text-danger disabled:cursor-not-allowed"
            >
              <i className="ti ti-x text-xs" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          id={id}
          type="text"
          value={draft}
          disabled={disabled}
          placeholder={segments.length === 0 ? placeholder : undefined}
          onChange={(event) => handleDraftChange(event.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={commitDraft}
          className="min-w-[80px] flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          {...autofillProps}
        />
      </div>
    </div>
  );
}
