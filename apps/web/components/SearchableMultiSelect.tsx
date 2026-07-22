'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
} from 'react';
import { createPortal } from 'react-dom';
import { computeDropdownPlacement } from './dropdownPlacement';
import {
  FORM_DROPDOWN_CLASS,
  FORM_DROPDOWN_EMPTY_CLASS,
  FORM_LABEL_CLASS,
  formDropdownOptionClass,
} from './formFieldStyles';
import { matchesSearchText } from '@/utils/searchText';
import type { SearchableSelectOption } from './SearchableSelect';
import { contrastTextOnHex } from './roleColors';
import { getSearchComboboxAutofillProps } from './inputAutofill';

export interface SearchableMultiSelectProps {
  id: string;
  label: string;
  values: string[];
  options: SearchableSelectOption[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  emptyMessage?: string;
  helperText?: string;
  disabled?: boolean;
  error?: string;
}

export function SearchableMultiSelect({
  id,
  label,
  values,
  options,
  onChange,
  placeholder = 'Caută funcție…',
  emptyMessage = 'Nicio funcție găsită.',
  helperText,
  disabled = false,
  error,
}: SearchableMultiSelectProps) {
  const listboxId = useId();
  const autofillTrapId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<ReturnType<typeof computeDropdownPlacement> | null>(null);

  const selectedOptions = useMemo(
    () => options.filter((option) => values.includes(option.id)),
    [options, values],
  );

  const availableOptions = useMemo(
    () => options.filter((option) => !values.includes(option.id)),
    [options, values],
  );

  const filteredOptions = useMemo(() => {
    return availableOptions.filter((option) => {
      const searchable = [option.label, option.description ?? ''].join(' ');
      return matchesSearchText(searchable, query);
    });
  }, [availableOptions, query]);

  const selectableOptions = useMemo(
    () => filteredOptions.filter((option) => !option.disabled),
    [filteredOptions],
  );

  const firstSelectableId = selectableOptions[0]?.id ?? null;

  const updateDropdownPosition = useCallback(() => {
    if (!fieldRef.current) {
      return;
    }

    setDropdownStyle(computeDropdownPlacement(fieldRef.current));
  }, []);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    updateDropdownPosition();

    function handleReposition() {
      updateDropdownPosition();
    }

    window.addEventListener('resize', handleReposition);
    window.addEventListener('scroll', handleReposition, true);

    return () => {
      window.removeEventListener('resize', handleReposition);
      window.removeEventListener('scroll', handleReposition, true);
    };
  }, [isOpen, updateDropdownPosition, filteredOptions.length]);

  function closeDropdown() {
    setIsOpen(false);
    setQuery('');
    setHighlightedId(null);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (fieldRef.current?.contains(target)) {
        return;
      }
      if (dropdownRef.current?.contains(target)) {
        return;
      }
      closeDropdown();
    }

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  function openDropdown() {
    if (disabled) {
      return;
    }
    setIsOpen(true);
    updateDropdownPosition();
    setHighlightedId(firstSelectableId);
  }

  function addOption(option: SearchableSelectOption) {
    if (option.disabled || values.includes(option.id)) {
      return;
    }
    onChange([...values, option.id]);
    closeDropdown();
    inputRef.current?.blur();
  }

  function removeOption(optionId: string) {
    onChange(values.filter((value) => value !== optionId));
    closeDropdown();
  }

  function handleInputBlur() {
    window.setTimeout(() => {
      const active = document.activeElement;
      if (fieldRef.current?.contains(active) || dropdownRef.current?.contains(active)) {
        return;
      }
      closeDropdown();
    }, 0);
  }

  function moveHighlight(direction: 1 | -1) {
    if (selectableOptions.length === 0) {
      return;
    }

    const currentIndex = highlightedId
      ? selectableOptions.findIndex((option) => option.id === highlightedId)
      : -1;

    let nextIndex = currentIndex + direction;
    if (nextIndex < 0) {
      nextIndex = selectableOptions.length - 1;
    }
    if (nextIndex >= selectableOptions.length) {
      nextIndex = 0;
    }

    setHighlightedId(selectableOptions[nextIndex]?.id ?? null);
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      moveHighlight(1);
      return;
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!isOpen) {
        openDropdown();
        return;
      }
      moveHighlight(-1);
      return;
    }

    if (event.key === 'Enter' && isOpen && highlightedId) {
      event.preventDefault();
      const option = selectableOptions.find((entry) => entry.id === highlightedId);
      if (option) {
        addOption(option);
      }
      return;
    }

    if (event.key === 'Escape') {
      closeDropdown();
    }
  }

  const dropdown =
    isOpen && dropdownStyle
      ? createPortal(
          <ul
            ref={dropdownRef}
            id={listboxId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className={FORM_DROPDOWN_CLASS}
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              maxHeight: dropdownStyle.maxHeight,
            }}
          >
            {selectableOptions.length === 0 ? (
              <li className={FORM_DROPDOWN_EMPTY_CLASS}>{emptyMessage}</li>
            ) : (
              selectableOptions.map((option) => {
                const isHighlighted = option.id === highlightedId;
                return (
                  <li key={option.id}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => addOption(option)}
                      className={`${formDropdownOptionClass(isHighlighted)} items-center`}
                    >
                      {option.color ? (
                        <span
                          className="size-2.5 shrink-0 rounded-sm"
                          style={{ backgroundColor: option.color }}
                          aria-hidden="true"
                        />
                      ) : null}
                      <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>,
          document.body,
        )
      : null;

  return (
    <div>
      <label id={`${id}-label`} htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
      </label>

      <div ref={fieldRef} className="relative">
        <div
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-labelledby={`${id}-label`}
          onMouseDown={(event) => {
            if (disabled) {
              return;
            }
            const target = event.target as HTMLElement;
            if (target.closest('button')) {
              return;
            }
            event.preventDefault();
            inputRef.current?.focus();
            openDropdown();
          }}
          className={`flex min-h-[42px] w-full flex-wrap items-center gap-1.5 rounded-md border border-border bg-bg py-2 pl-3 pr-10 transition-colors hover:border-text-muted/40 focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25${
            disabled ? ' cursor-not-allowed opacity-60' : ''
          }`}
        >
          {selectedOptions.map((option) => {
            const chipTextColor = option.color ? contrastTextOnHex(option.color) : undefined;

            return (
              <span
                key={option.id}
                className={`inline-flex max-w-full items-center gap-1 rounded border px-1.5 py-0.5 text-xs${
                  option.color ? '' : ' border-border-subtle bg-surface text-text-primary'
                }`}
                style={
                  option.color
                    ? {
                        backgroundColor: option.color,
                        borderColor: option.color,
                        color: chipTextColor,
                      }
                    : undefined
                }
              >
                <span>{option.label}</span>
                <button
                  type="button"
                  disabled={disabled}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => removeOption(option.id)}
                  aria-label={`Elimină ${option.label}`}
                  className="shrink-0 opacity-80 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
                  style={chipTextColor ? { color: chipTextColor } : undefined}
                >
                  <i className="ti ti-x text-xs" aria-hidden="true" />
                </button>
              </span>
            );
          })}

          <input
            ref={inputRef}
            id={id}
            type="text"
            value={query}
            disabled={disabled}
            placeholder={selectedOptions.length === 0 ? placeholder : ''}
            aria-autocomplete="list"
            {...getSearchComboboxAutofillProps(autofillTrapId)}
            onFocus={openDropdown}
            onBlur={handleInputBlur}
            onChange={(event) => {
              setQuery(event.target.value);
              if (!isOpen) {
                openDropdown();
              }
            }}
            onKeyDown={handleKeyDown}
            className={`min-w-[6rem] border-0 bg-transparent py-0.5 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:ring-0 disabled:cursor-not-allowed${
              selectedOptions.length === 0 ? 'min-w-0 flex-1 basis-full' : 'flex-1 basis-[6rem]'
            }`}
          />
        </div>

        <i
          className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} pointer-events-none absolute right-3 top-3 text-base text-text-secondary`}
          aria-hidden="true"
        />
      </div>

      {helperText && <p className="mt-1.5 text-xs text-text-muted">{helperText}</p>}
      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}

      {dropdown}
    </div>
  );
}
