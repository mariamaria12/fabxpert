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
import { matchesSearchText } from '@/utils/searchText';
import type { SearchableSelectOption } from './SearchableSelect';

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

const DROPDOWN_GAP_PX = 4;
const DROPDOWN_MAX_HEIGHT_PX = 224;

type DropdownPlacement = {
  top: number;
  left: number;
  width: number;
  maxHeight: number;
};

function computeDropdownPlacement(input: HTMLElement): DropdownPlacement {
  const rect = input.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom - DROPDOWN_GAP_PX;
  const spaceAbove = rect.top - DROPDOWN_GAP_PX;
  const openUpward = spaceBelow < 180 && spaceAbove > spaceBelow;

  if (openUpward) {
    const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, spaceAbove);
    return {
      top: rect.top - DROPDOWN_GAP_PX - maxHeight,
      left: rect.left,
      width: rect.width,
      maxHeight,
    };
  }

  const maxHeight = Math.min(DROPDOWN_MAX_HEIGHT_PX, spaceBelow);
  return {
    top: rect.bottom + DROPDOWN_GAP_PX,
    left: rect.left,
    width: rect.width,
    maxHeight,
  };
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised py-[10px] pl-3 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

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
  const inputRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<DropdownPlacement | null>(null);

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
    if (!inputRef.current) {
      return;
    }

    setDropdownStyle(computeDropdownPlacement(inputRef.current));
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
    setQuery('');
    setHighlightedId(firstSelectableId);
    inputRef.current?.focus();
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
            className="fixed z-[70] overflow-y-auto rounded-md border border-border-subtle bg-surface py-1 shadow-lg"
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
              maxHeight: dropdownStyle.maxHeight,
            }}
          >
            {selectableOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">{emptyMessage}</li>
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
                      className={`flex w-full items-center px-3 py-2 text-left text-sm transition-colors ${
                        isHighlighted
                          ? 'bg-surface-raised text-text-primary'
                          : 'text-text-primary hover:bg-surface-raised'
                      }`}
                    >
                      <span className="truncate">{option.label}</span>
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
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
        {label}
      </label>

      {selectedOptions.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {selectedOptions.map((option) => (
            <span
              key={option.id}
              className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface-raised px-2 py-1 text-xs text-text-primary"
            >
              <span>{option.label}</span>
              <button
                type="button"
                disabled={disabled}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => removeOption(option.id)}
                aria-label={`Elimină ${option.label}`}
                className="text-text-muted transition-colors hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-40"
              >
                <i className="ti ti-x text-sm" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div ref={fieldRef} className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          value={query}
          disabled={disabled}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-autocomplete="list"
          onFocus={openDropdown}
          onBlur={handleInputBlur}
          onChange={(event) => {
            setQuery(event.target.value);
            if (!isOpen) {
              openDropdown();
            }
          }}
          onKeyDown={handleKeyDown}
          className={inputClassName}
        />
        <i
          className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-text-muted`}
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
