import { ApiError, listAvailableProjects, listMyTimesheets, subscribeToAvailableProjects } from '@fabxpert/shared';
import type { ProjectOptionDto } from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ProjectListSkeleton,
  TodayTotalBannerSkeleton,
} from './skeletons/OptionListSkeleton';
import {
  formatTodayWorkedTotal,
  sumTodayClosedMinutes,
} from '../utils/timeUtils';
import { projectOptionTintStyle } from '../utils/colorUtils';

interface ProjectSelectProps {
  onChoose: (project: ProjectOptionDto) => void;
  onOpenMyTimesheets: () => void;
}

function ClockIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className="today-total-banner-icon"
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 7v5l3 3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.75" />
    </svg>
  );
}

export function ProjectSelect({ onChoose, onOpenMyTimesheets }: ProjectSelectProps) {
  const [projects, setProjects] = useState<ProjectOptionDto[]>([]);
  const [isFetchingProjects, setIsFetchingProjects] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [todayTotalLoaded, setTodayTotalLoaded] = useState(false);
  const [isFetchingTodayTotal, setIsFetchingTodayTotal] = useState(true);
  const debounceRef = useRef<number | null>(null);

  const showProjectsSkeleton = isFetchingProjects && projects.length === 0 && !error;
  const showBannerSkeleton = isFetchingTodayTotal && !todayTotalLoaded;

  const loadProjects = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!silent) {
      setIsFetchingProjects(true);
      setError(null);
    }

    try {
      const projectsData = await listAvailableProjects();
      setProjects(projectsData);
      if (!silent) {
        setError(null);
      }
    } catch (caught) {
      if (!silent) {
        if (caught instanceof ApiError && caught.status === 0) {
          setError('Nu s-a putut contacta serverul.');
        } else {
          setError('Nu s-au putut încărca proiectele.');
        }
      }
    } finally {
      if (!silent) {
        setIsFetchingProjects(false);
      }
    }
  }, []);

  const loadTodayTotal = useCallback(async () => {
    setIsFetchingTodayTotal(true);

    try {
      const minePage = await listMyTimesheets(1);
      // MVP: page 1 only (default pageSize, startTime desc). If a user has more
      // than a page of entries today, older ones that fell off page 1 are excluded.
      setTodayMinutes(sumTodayClosedMinutes(minePage.data));
    } catch {
      // Banner is secondary — keep previous value on refetch failure.
      if (!todayTotalLoaded) {
        setTodayMinutes(0);
      }
    } finally {
      setTodayTotalLoaded(true);
      setIsFetchingTodayTotal(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
    void loadTodayTotal();
  }, [loadProjects, loadTodayTotal]);

  useEffect(() => {
    const unsubscribe = subscribeToAvailableProjects(() => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }

      debounceRef.current = window.setTimeout(() => {
        void loadProjects({ silent: true });
        debounceRef.current = null;
      }, 1000);
    });

    return () => {
      unsubscribe();
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current);
      }
    };
  }, [loadProjects]);

  const bannerText =
    todayMinutes > 0
      ? `Azi ai lucrat ${formatTodayWorkedTotal(todayMinutes)}`
      : 'Azi nu ai pontat încă';

  const showProjectList = !error && projects.length > 0;
  const showProjectError = !isFetchingProjects && Boolean(error);
  const showEmptyProjects =
    !isFetchingProjects && !error && projects.length === 0;

  return (
    <div className="flow-content">
      {showBannerSkeleton ? (
        <TodayTotalBannerSkeleton />
      ) : (
        <button
          type="button"
          className={`today-total-banner today-total-banner-tappable${todayMinutes === 0 && todayTotalLoaded ? ' today-total-banner-empty' : ''}`}
          aria-label="Vezi pontajele mele"
          aria-live="polite"
          disabled={!todayTotalLoaded}
          onClick={onOpenMyTimesheets}
        >
          <span className="today-total-banner-main">
            <ClockIcon />
            <p className="today-total-banner-text">{bannerText}</p>
          </span>
          <span className="today-total-banner-eye" aria-hidden="true">
            <EyeIcon />
          </span>
        </button>
      )}

      <p className="flow-step-label">PASUL 1 DIN 2</p>
      <h2 className="flow-heading">Alege proiectul</h2>

      {showProjectsSkeleton && <ProjectListSkeleton />}

      {showProjectError && (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button
            type="button"
            className="flow-retry-button"
            onClick={() => {
              void loadProjects();
              void loadTodayTotal();
            }}
          >
            Reîncearcă
          </button>
        </div>
      )}

      {showEmptyProjects && (
        <p className="flow-status">Nu există proiecte disponibile.</p>
      )}

      {showProjectList && (
        <ul className="option-list" role="listbox" aria-label="Proiecte disponibile">
          {projects.map((project) => {
            const tintStyle = projectOptionTintStyle(project.color);
            const hasTint = Boolean(project.color && tintStyle.background);

            return (
            <li key={project.id}>
              <button
                type="button"
                role="option"
                className={`option-row${hasTint ? ' option-row-project-tinted' : ''}`}
                style={hasTint ? tintStyle : undefined}
                onClick={() => onChoose(project)}
              >
                <span
                  className="option-color-bar option-color-bar-project"
                  style={{ background: project.color ?? 'var(--color-border)' }}
                  aria-hidden="true"
                />
                <span className="option-row-body">
                  <span className="option-row-title">{project.name}</span>
                  <span className="option-row-code">{project.code}</span>
                </span>
              </button>
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
