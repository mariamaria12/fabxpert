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
  FORM_COMBO_INPUT_CLASS,
  FORM_DROPDOWN_CLASS,
  FORM_LABEL_CLASS,
  formDropdownOptionClass,
} from './formFieldStyles';
import { getBusinessInputAutofillProps } from './inputAutofill';
import { matchesSearchText } from '@/utils/searchText';

export interface SearchableSelectOption {
  id: string;
  label: string;
  description?: string;
  disabled?: boolean;
  disabledSuffix?: string;
}

export interface SearchableSelectProps {
  id: string;
  label: string;
  value: string | null;
  options: SearchableSelectOption[];
  onChange: (value: string | null) => void;
  placeholder?: string;
  emptyMessage?: string;
  required?: boolean;
  disabled?: boolean;
  error?: string;
  /** Shown when value is set but the matching option is not loaded yet. */
  selectedLabel?: string;
  /** When false, selection cannot be cleared (always shows chevron, no ×). */
  clearable?: boolean;
}

export function SearchableSelect({
  id,
  label,
  value,
  options,
  onChange,
  placeholder = 'Caută…',
  emptyMessage = 'Niciun rezultat găsit.',
  required = false,
  disabled = false,
  error,
  selectedLabel,
  clearable = true,
}: SearchableSelectProps) {
  const listboxId = useId();
  const autofillTrapId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLUListElement>(null);
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
    maxHeight: number;
  } | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const closedLabel = selectedOption?.label ?? selectedLabel ?? '';
  const displayValue = isOpen ? query : closedLabel;

  const filteredOptions = useMemo(() => {
    return options.filter((option) => {
      const searchable = [option.label, option.description ?? ''].join(' ');
      return matchesSearchText(searchable, query);
    });
  }, [options, query]);

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

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      if (dropdownRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
      setQuery('');
    }

    document.addEventListener('mousedown', handlePointerDown, true);
    return () => document.removeEventListener('mousedown', handlePointerDown, true);
  }, [isOpen]);

  function openDropdown() {
    if (disabled) {
      return;
    }
    if (isOpen) {
      updateDropdownPosition();
      return;
    }
    setQuery(closedLabel);
    setIsOpen(true);
    updateDropdownPosition();
    setHighlightedId(firstSelectableId);
  }

  function closeDropdown() {
    setIsOpen(false);
    setQuery('');
    setHighlightedId(null);
  }

  function selectOption(option: SearchableSelectOption) {
    if (option.disabled) {
      return;
    }
    onChange(option.id);
    closeDropdown();
    inputRef.current?.blur();
  }

  function clearSelection() {
    onChange(null);
    setQuery('');
    setHighlightedId(firstSelectableId);
    inputRef.current?.focus();
    setIsOpen(true);
    updateDropdownPosition();
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
    if (disabled) {
      return;
    }

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

    if (event.key === 'Enter') {
      if (!isOpen) {
        openDropdown();
        return;
      }
      event.preventDefault();
      const highlighted = selectableOptions.find((option) => option.id === highlightedId);
      if (highlighted) {
        selectOption(highlighted);
      }
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      closeDropdown();
    }
  }

  const highlightedOptionId = highlightedId;

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
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-text-muted">{emptyMessage}</li>
            ) : (
              filteredOptions.map((option) => {
                const isHighlighted = option.id === highlightedOptionId;
                return (
                  <li key={option.id} role="presentation">
                    <button
                      type="button"
                      role="option"
                      aria-selected={value === option.id}
                      disabled={option.disabled}
                      onMouseDown={(event) => {
                        event.preventDefault();
                        selectOption(option);
                      }}
                      className={formDropdownOptionClass(isHighlighted)}
                    >
                      <span className={option.disabled ? 'text-text-muted' : 'font-medium'}>
                        {option.label}
                      </span>
                      {option.description && (
                        <span className="text-text-muted">· {option.description}</span>
                      )}
                      {option.disabled && option.disabledSuffix && (
                        <span className="text-text-muted">· {option.disabledSuffix}</span>
                      )}
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
    <div ref={containerRef} className="relative">
      <label id={`${id}-label`} htmlFor={id} className={FORM_LABEL_CLASS}>
        {label}
        {required && <span className="text-danger"> *</span>}
      </label>

      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-haspopup="listbox"
          aria-autocomplete="list"
          {...getBusinessInputAutofillProps(autofillTrapId)}
          value={displayValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(event) => {
            const nextText = event.target.value;
            setQuery(nextText);
            if (value !== null && nextText !== closedLabel && clearable) {
              onChange(null);
            }
            if (!isOpen) {
              setIsOpen(true);
              updateDropdownPosition();
            }
            setHighlightedId(firstSelectableId);
          }}
          onKeyDown={handleKeyDown}
          className={FORM_COMBO_INPUT_CLASS}
        />

        {value && !disabled && clearable ? (
          <button
            type="button"
            aria-label="Șterge selecția"
            onMouseDown={(event) => event.preventDefault()}
            onClick={clearSelection}
            className="absolute right-2 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded text-text-secondary transition-colors hover:bg-surface hover:text-text-primary"
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        ) : (
          <i
            className={`ti ${isOpen ? 'ti-chevron-up' : 'ti-chevron-down'} pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-base text-text-secondary`}
            aria-hidden="true"
          />
        )}
      </div>

      {error && (
        <p role="alert" className="mt-1 text-xs text-danger">
          {error}
        </p>
      )}

      {dropdown}
    </div>
  );
}
