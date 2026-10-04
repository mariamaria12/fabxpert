'use client';

import { formatPersonName, type TaskUserDto } from '@fabxpert/shared';
import { useId, useRef, useState, type KeyboardEvent } from 'react';
import {
  FORM_DROPDOWN_CLASS,
  FORM_DROPDOWN_EMPTY_CLASS,
  FORM_LABEL_CLASS,
  formDropdownOptionClass,
} from '@/components/formFieldStyles';
import { useSearchAutofillProps } from '@/components/inputAutofill';
import { getPersonInitials } from '@/components/PersonAvatar';
import { matchesSearchText } from '@/utils/searchText';

interface TaskRecipientsFieldProps {
  users: TaskUserDto[];
  /** The ids of the chosen users, in the order they were picked. */
  value: string[];
  /** Shown as "Mie" once picked. */
  currentUserId?: string;
  loading?: boolean;
  disabled?: boolean;
  error?: string;
  onChange: (userIds: string[]) => void;
}

/**
 * The "Către" line of an email: the chosen admins as chips, with a field
 * beside them that searches the ones left.
 */
export function TaskRecipientsField({
  users,
  value,
  currentUserId,
  loading = false,
  disabled = false,
  error,
  onChange,
}: TaskRecipientsFieldProps) {
  const inputId = useId();
  const listboxId = useId();
  const autofill = useSearchAutofillProps();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);

  const selected = value.flatMap((id) => users.find((user) => user.id === id) ?? []);
  const matches = users.filter(
    (user) => !value.includes(user.id) && matchesSearchText(formatPersonName(user), query),
  );
  const activeIndex = Math.min(highlighted, matches.length - 1);

  function add(user: TaskUserDto) {
    onChange([...value, user.id]);
    setQuery('');
    setHighlighted(0);
    // One pick is the usual case; typing or a click brings the list back for more.
    setOpen(false);
  }

  function remove(userId: string) {
    onChange(value.filter((id) => id !== userId));
    inputRef.current?.focus();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setOpen(true);
      if (matches.length > 0) {
        const step = event.key === 'ArrowDown' ? 1 : -1;
        setHighlighted((activeIndex + step + matches.length) % matches.length);
      }
      return;
    }
    if (event.key === 'Enter') {
      // With the list open Enter picks a person; it only sends once the list is closed.
      if (open && matches[activeIndex]) {
        event.preventDefault();
        add(matches[activeIndex]);
      }
      return;
    }
    if (event.key === 'Escape' && open) {
      event.stopPropagation();
      setOpen(false);
      return;
    }
    if (event.key === 'Backspace' && !query && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  }

  return (
    <div className="relative">
      <label htmlFor={inputId} className={FORM_LABEL_CLASS}>
        Către
      </label>
      <div
        onClick={() => {
          inputRef.current?.focus();
          setOpen(true);
        }}
        className={`flex min-h-[42px] cursor-text flex-wrap items-center gap-1.5 rounded-md border bg-surface-raised px-2 py-1.5 transition-colors focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25 ${
          error ? 'border-danger-border' : 'border-border'
        } ${disabled ? 'opacity-60' : ''}`}
      >
        {selected.map((user) => (
          <span
            key={user.id}
            className="flex max-w-full items-center gap-1.5 rounded-full border border-[var(--color-primary-border)] bg-[var(--color-accent-tint-strong)] py-0.5 pl-0.5 pr-1 text-sm text-text-primary"
          >
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-[10px] font-medium text-accent-contrast"
              aria-hidden="true"
            >
              {getPersonInitials(user)}
            </span>
            <span className="min-w-0 truncate">
              {user.id === currentUserId ? 'Mie' : formatPersonName(user)}
            </span>
            <button
              type="button"
              disabled={disabled}
              aria-label={`Scoate pe ${formatPersonName(user)}`}
              onClick={(event) => {
                event.stopPropagation();
                remove(user.id);
              }}
              className="flex size-5 shrink-0 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-surface-hover hover:text-text-primary disabled:cursor-not-allowed"
            >
              <i className="ti ti-x text-xs" aria-hidden="true" />
            </button>
          </span>
        ))}
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          aria-invalid={error ? true : undefined}
          value={query}
          disabled={disabled}
          placeholder={
            loading ? 'Se încarcă…' : selected.length > 0 ? 'Mai adaugă…' : 'Cui îi trimiți?'
          }
          onChange={(event) => {
            setQuery(event.target.value);
            setHighlighted(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false);
            setQuery('');
          }}
          onKeyDown={handleKeyDown}
          className="min-w-[7rem] flex-1 bg-transparent px-1 py-1 text-sm text-text-primary placeholder:text-text-muted focus:outline-none disabled:cursor-not-allowed"
          {...autofill}
        />
      </div>

      {open && !loading && (matches.length > 0 || query) ? (
        <ul
          id={listboxId}
          role="listbox"
          aria-label="Administratori"
          className={`${FORM_DROPDOWN_CLASS} left-0 right-0 mt-1 max-h-60`}
        >
          {matches.length === 0 ? (
            <li className={FORM_DROPDOWN_EMPTY_CLASS}>Niciun administrator găsit.</li>
          ) : (
            matches.map((user, index) => (
              <li key={user.id} role="option" aria-selected={index === activeIndex}>
                <button
                  type="button"
                  tabIndex={-1}
                  // Keeps the field focused, ready for the next name to be typed.
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setHighlighted(index)}
                  onClick={() => add(user)}
                  className={formDropdownOptionClass(index === activeIndex)}
                >
                  <span
                    className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-raised text-[10px] font-medium text-text-secondary"
                    aria-hidden="true"
                  >
                    {getPersonInitials(user)}
                  </span>
                  <span className="min-w-0 truncate">
                    {formatPersonName(user)}
                    {user.id === currentUserId ? (
                      <span className="text-text-muted"> (eu)</span>
                    ) : null}
                  </span>
                </button>
              </li>
            ))
          )}
        </ul>
      ) : null}

      {error ? <p className="mt-1.5 text-xs text-danger">{error}</p> : null}
    </div>
  );
}
