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
}

const inputClassName =
  'w-full rounded-md border border-border bg-surface-raised py-[10px] pl-3 pr-9 text-sm text-text-primary placeholder:text-text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent';

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
}: SearchableSelectProps) {
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  /** Avoid clearing the input before the parent applies the new value after selection. */
  const pendingValueRef = useRef<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedId, setHighlightedId] = useState<string | null>(null);
  const [dropdownStyle, setDropdownStyle] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);

  const selectedOption = useMemo(
    () => options.find((option) => option.id === value) ?? null,
    [options, value],
  );

  const filteredOptions = useMemo(() => {
    return options.filter((option) => {
      const searchable = [option.label, option.description ?? ''].join(' ');
      return matchesSearchText(searchable, inputText);
    });
  }, [options, inputText]);

  const selectableOptions = useMemo(
    () => filteredOptions.filter((option) => !option.disabled),
    [filteredOptions],
  );

  const firstSelectableId = selectableOptions[0]?.id ?? null;

  const updateDropdownPosition = useCallback(() => {
    const rect = inputRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    setDropdownStyle({
      top: rect.bottom + 4,
      left: rect.left,
      width: rect.width,
    });
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
    if (value !== null && value === pendingValueRef.current) {
      pendingValueRef.current = null;
    }
  }, [value]);

  useEffect(() => {
    if (isOpen) {
      return;
    }

    if (selectedOption) {
      setInputText(selectedOption.label);
      return;
    }

    if (value !== null && selectedLabel) {
      setInputText(selectedLabel);
      return;
    }

    if (value === null && pendingValueRef.current === null) {
      setInputText('');
    }
  }, [selectedOption, isOpen, value, selectedLabel]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handlePointerDown(event: MouseEvent) {
      const target = event.target as Node;
      if (containerRef.current?.contains(target)) {
        return;
      }
      setIsOpen(false);
      if (selectedOption) {
        setInputText(selectedOption.label);
      } else if (value !== null && selectedLabel) {
        setInputText(selectedLabel);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [isOpen, selectedOption, value, selectedLabel]);

  function openDropdown() {
    if (disabled) {
      return;
    }
    setIsOpen(true);
    updateDropdownPosition();
    setHighlightedId(firstSelectableId);
  }

  function selectOption(option: SearchableSelectOption) {
    if (option.disabled) {
      return;
    }
    pendingValueRef.current = option.id;
    onChange(option.id);
    setInputText(option.label);
    setIsOpen(false);
    setHighlightedId(null);
  }

  function clearSelection() {
    pendingValueRef.current = null;
    onChange(null);
    setInputText('');
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
      setIsOpen(false);
      if (selectedOption) {
        setInputText(selectedOption.label);
      }
    }
  }

  const highlightedOptionId = highlightedId;

  const dropdown =
    isOpen && dropdownStyle
      ? createPortal(
          <ul
            id={listboxId}
            role="listbox"
            aria-labelledby={`${id}-label`}
            className="fixed z-[60] max-h-60 overflow-y-auto rounded-md border border-border bg-surface py-1 shadow-lg"
            style={{
              top: dropdownStyle.top,
              left: dropdownStyle.left,
              width: dropdownStyle.width,
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
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => selectOption(option)}
                      className={`flex w-full items-baseline gap-2 px-3 py-2 text-left text-sm transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        isHighlighted
                          ? 'bg-accent/10 text-accent'
                          : 'text-text-primary hover:bg-surface-raised'
                      }`}
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
      <label id={`${id}-label`} htmlFor={id} className="mb-1.5 block text-xs text-text-secondary">
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
          aria-autocomplete="list"
          value={inputText}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={openDropdown}
          onClick={openDropdown}
          onChange={(event) => {
            const nextText = event.target.value;
            setInputText(nextText);
            if (selectedOption && nextText !== selectedOption.label) {
              onChange(null);
            }
            openDropdown();
            setHighlightedId(firstSelectableId);
          }}
          onKeyDown={handleKeyDown}
          className={inputClassName}
        />

        {value && !disabled && (
          <button
            type="button"
            aria-label="Șterge selecția"
            onClick={clearSelection}
            className="absolute right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded text-text-muted transition-colors hover:bg-surface hover:text-text-primary"
          >
            <i className="ti ti-x text-sm" aria-hidden="true" />
          </button>
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
