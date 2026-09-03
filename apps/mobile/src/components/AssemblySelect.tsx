import { assemblyDoneForActivity, assemblyRemainingForActivity } from '@fabxpert/shared';
import type { ActivityDto, ProjectAssemblyDto } from '@fabxpert/shared';
import { useEffect, useId, useMemo, useState } from 'react';
import { ActivityListSkeleton } from './skeletons/OptionListSkeleton';
import { getBusinessInputAutofillProps } from '../utils/inputAutofill';
import {
  countWithNoun,
  formatAssemblyMeta,
  groupAssembliesByProfile,
  matchesAssemblySearch,
  type AssemblySelection,
} from '../utils/assemblyUtils';

interface AssemblySelectProps {
  activity: ActivityDto;
  /** Fetched by the flow while the activity was being picked. */
  assemblies: ProjectAssemblyDto[];
  isLoading: boolean;
  error: string | null;
  onRetry: () => void;
  selection: AssemblySelection[];
  onToggle: (assembly: ProjectAssemblyDto) => void;
  /** Log time without any assembly — the "I helped with the assembling" path. */
  onSkip: () => void;
  /** A project with no list at all goes straight to the time screen, as before. */
  onEmptyList: () => void;
  onContinue: () => void;
}

function SearchIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M16 16l4 4"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5l4.5 4.5L19 7"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function AssemblySelect({
  activity,
  assemblies,
  isLoading,
  error,
  onRetry,
  selection,
  onToggle,
  onSkip,
  onEmptyList,
  onContinue,
}: AssemblySelectProps) {
  const [search, setSearch] = useState('');
  const [showCompleted, setShowCompleted] = useState(false);
  const autofillTrapId = useId();
  const searchAutofill = useMemo(
    () => getBusinessInputAutofillProps(autofillTrapId),
    [autofillTrapId],
  );

  /** The list can still land empty here when the fetch was slower than the tap. */
  useEffect(() => {
    if (!isLoading && !error && assemblies.length === 0) {
      onEmptyList();
    }
  }, [isLoading, error, assemblies.length, onEmptyList]);

  const selectedIds = useMemo(
    () => new Set(selection.map((entry) => entry.assembly.id)),
    [selection],
  );

  /** Finished assemblies stay out of the way until they are asked for. */
  const { pending, completed } = useMemo(() => {
    const open: ProjectAssemblyDto[] = [];
    const done: ProjectAssemblyDto[] = [];

    for (const assembly of assemblies) {
      if (assemblyRemainingForActivity(assembly, activity.id) > 0) {
        open.push(assembly);
      } else {
        done.push(assembly);
      }
    }

    return { pending: open, completed: done };
  }, [assemblies, activity.id]);

  const isSearching = search.trim().length > 0;
  const searchResults = useMemo(
    () =>
      isSearching
        ? [...pending, ...completed].filter((assembly) =>
            matchesAssemblySearch(assembly, search),
          )
        : [],
    [isSearching, pending, completed, search],
  );
  const groups = useMemo(() => groupAssembliesByProfile(pending), [pending]);

  function renderRow(assembly: ProjectAssemblyDto) {
    const isSelected = selectedIds.has(assembly.id);
    const remaining = assemblyRemainingForActivity(assembly, activity.id);
    const done = assemblyDoneForActivity(assembly, activity.id);
    const meta = formatAssemblyMeta(assembly, { includeProfile: true });
    const body = (
      <>
        <span className="option-row-body">
          <span className="option-row-title assembly-mark">{assembly.name}</span>
          {meta ? <span className="assembly-meta">{meta}</span> : null}
        </span>
        {remaining > 0 ? (
          <span className="assembly-chip assembly-chip-remaining">
            {done > 0 ? `${remaining}/${assembly.quantity}` : remaining}{' '}
            {remaining === 1 ? 'rămasă' : 'rămase'}
          </span>
        ) : (
          <span className="assembly-chip assembly-chip-complete">
            gata {done}/{assembly.quantity}
          </span>
        )}
      </>
    );

    // Nothing left to report on a finished assembly, so it is shown, not offered.
    if (remaining === 0) {
      return (
        <li key={assembly.id}>
          <div className="option-row assembly-row assembly-row-static">
            <span className="assembly-check assembly-check-done" aria-hidden="true">
              <CheckIcon />
            </span>
            {body}
          </div>
        </li>
      );
    }

    return (
      <li key={assembly.id}>
        <button
          type="button"
          className={`option-row assembly-row${isSelected ? ' option-row-selected' : ''}`}
          aria-pressed={isSelected}
          onClick={() => onToggle(assembly)}
        >
          <span
            className={`assembly-check${isSelected ? ' assembly-check-on' : ''}`}
            aria-hidden="true"
          >
            <CheckIcon />
          </span>
          {body}
        </button>
      </li>
    );
  }

  /**
   * Nothing to show yet — and no picker chrome either, so a project that turns
   * out to have no list does not flash a screen the worker cannot use.
   */
  if (isLoading && assemblies.length === 0) {
    return (
      <div className="flow-screen">
        <div className="flow-content">
          <ActivityListSkeleton label="Se încarcă ansamblele" />
        </div>
      </div>
    );
  }

  const selectedCount = selection.length;

  return (
    <div className="flow-screen">
      <div className="flow-content">
        {selectedCount === 0 ? (
          <>
            <button type="button" className="flow-primary-button" onClick={onSkip}>
              Logare timp
            </button>
            <p className="assembly-skip-hint">
              Fără ansamble — pentru cei care ajută la asamblare
            </p>
          </>
        ) : (
          <button type="button" className="flow-secondary-button" onClick={onSkip}>
            Logare timp fără ansamble
          </button>
        )}

        <div className="flow-divider">
          {selectedCount === 0 ? 'SAU ALEGE CE AI LUCRAT' : `${selectedCount} ALESE`}
        </div>

        <label className="assembly-search">
          <span className="assembly-search-icon">
            <SearchIcon />
          </span>
          <input
            type="text"
            className="assembly-search-input"
            placeholder="Caută marca (ex. GBAL)"
            aria-label="Caută ansamblu"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            {...searchAutofill}
          />
          {isSearching ? (
            <button
              type="button"
              className="assembly-search-clear"
              aria-label="Șterge căutarea"
              onClick={() => setSearch('')}
            >
              ✕
            </button>
          ) : null}
        </label>

        {error ? (
          <div className="flow-error-block">
            <p className="flow-error-text">{error}</p>
            <button type="button" className="flow-retry-button" onClick={onRetry}>
              Reîncearcă
            </button>
          </div>
        ) : null}

        {!error && isSearching ? (
          searchResults.length > 0 ? (
            <>
              <p className="assembly-group-label">
                {countWithNoun(searchResults.length, 'rezultat', 'rezultate')}
              </p>
              <ul className="option-list">
                {searchResults.map((assembly) => renderRow(assembly))}
              </ul>
            </>
          ) : (
            <p className="flow-status">Niciun ansamblu nu se potrivește.</p>
          )
        ) : null}

        {!error && !isSearching ? (
          <>
            {groups.map((group) => (
              <div key={group.key}>
                <p className="assembly-group-label">
                  {group.label} · {countWithNoun(group.assemblies.length, 'ansamblu', 'ansamble')}
                </p>
                <ul className="option-list">
                  {group.assemblies.map((assembly) => renderRow(assembly))}
                </ul>
              </div>
            ))}

            {pending.length === 0 ? (
              <p className="flow-status">
                Tot ce e pe listă e gata la {activity.name.toLowerCase()}.
              </p>
            ) : null}

            {completed.length > 0 && !showCompleted ? (
              <button
                type="button"
                className="assembly-completed-toggle"
                onClick={() => setShowCompleted(true)}
              >
                Vezi ansamblele finalizate ({completed.length})
              </button>
            ) : null}

            {completed.length > 0 && showCompleted ? (
              <div className="assembly-completed-block">
                <p className="assembly-group-label">Finalizate</p>
                <ul className="option-list">
                  {completed.map((assembly) => renderRow(assembly))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {selectedCount > 0 ? (
        <div className="flow-footer">
          <div className="assembly-footer-meta">
            <span>{countWithNoun(selectedCount, 'ansamblu ales', 'ansamble alese')}</span>
            <span>{activity.name}</span>
          </div>
          <button type="button" className="flow-primary-button" onClick={onContinue}>
            Continuă
          </button>
        </div>
      ) : null}
    </div>
  );
}
