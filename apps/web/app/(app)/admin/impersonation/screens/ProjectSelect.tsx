import { useState } from 'react';
import { FinisajBadge } from '@/components/FinisajBadge';
import type { MeResponse, ProjectOptionDto } from '@fabxpert/shared';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import {
  ProjectListSkeleton,
  TodayTotalBannerSkeleton,
} from './skeletons/OptionListSkeleton';
import { formatTodayWorkedTotal, formatMobileTodayDate } from '../utils/timeUtils';
import { getUserFirstName } from '../utils/userDisplay';
import { projectOptionTintStyle } from '../utils/colorUtils';

interface ProjectSelectProps {
  user: MeResponse;
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

function InfoIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 11v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <circle cx="12" cy="7.75" r="1" fill="currentColor" />
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

function RefreshIcon({ spinning }: { spinning: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={spinning ? 'flow-refresh-icon flow-refresh-icon-spinning' : 'flow-refresh-icon'}
    >
      <path
        d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 3v5h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16 16h5v5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ProjectSelect({ user, onChoose, onOpenMyTimesheets }: ProjectSelectProps) {
  const {
    projects,
    projectsError,
    isFetchingProjects,
    refreshProjects,
    todayMinutes,
    myTimesheetsPage1Loaded,
    isFetchingMyTimesheetsPage1,
    refreshMyTimesheetsPage1,
  } = useMobileLookupCache();

  // One notes panel open at a time keeps the list quiet.
  const [expandedNotesId, setExpandedNotesId] = useState<string | null>(null);

  const showProjectsSkeleton = isFetchingProjects && projects.length === 0 && !projectsError;
  const showBannerSkeleton = isFetchingMyTimesheetsPage1 && !myTimesheetsPage1Loaded;

  const bannerText =
    todayMinutes > 0
      ? `Azi ai lucrat ${formatTodayWorkedTotal(todayMinutes)}`
      : 'Azi nu ai pontat încă';

  const showProjectList = !projectsError && projects.length > 0;
  const showProjectError = !isFetchingProjects && Boolean(projectsError);
  const showEmptyProjects =
    !isFetchingProjects && !projectsError && projects.length === 0;

  return (
    <div className="flow-content">
      <div className="flow-home-greeting">
        <p className="flow-home-greeting-title">Bună, {getUserFirstName(user)}</p>
        <p className="flow-home-greeting-date">{formatMobileTodayDate()}</p>
      </div>

      {showBannerSkeleton ? (
        <TodayTotalBannerSkeleton />
      ) : (
        <button
          type="button"
          className={`today-total-banner today-total-banner-tappable${todayMinutes === 0 && myTimesheetsPage1Loaded ? ' today-total-banner-empty' : ''}`}
          aria-label="Vezi pontajele mele"
          aria-live="polite"
          disabled={!myTimesheetsPage1Loaded}
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
      <div className="flow-heading-row">
        <h2 className="flow-heading">Alege proiectul</h2>
        <button
          type="button"
          className="flow-refresh-button"
          onClick={() => void refreshProjects()}
          disabled={isFetchingProjects}
          aria-label="Reîmprospătează proiectele"
          aria-busy={isFetchingProjects}
        >
          <RefreshIcon spinning={isFetchingProjects} />
        </button>
      </div>

      {showProjectsSkeleton && <ProjectListSkeleton />}

      {showProjectError && (
        <div className="flow-error-block">
          <p className="flow-error-text">{projectsError}</p>
          <button
            type="button"
            className="flow-retry-button"
            onClick={() => {
              void refreshProjects();
              void refreshMyTimesheetsPage1({ force: true });
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

            const notes = project.notes?.trim() ?? '';
            const notesOpen = expandedNotesId === project.id;

            return (
            <li
              key={project.id}
              className={`option-row-shell${notes ? ' option-row-shell-has-notes' : ''}${
                notesOpen ? ' option-row-shell-open' : ''
              }`}
            >
              <div className="option-row-card">
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
                  <span className="option-row-title-line">
                    <span className="option-row-title">{project.code}</span>
                    <FinisajBadge value={project.finisaj} className="ml-auto" />
                  </span>
                  {project.denumireLucrare && (
                    <span className="option-row-subtitle">{project.denumireLucrare}</span>
                  )}
                  <span className="option-row-code">{project.company.name}</span>
                </span>
              </button>

              {notes && (
                <button
                  type="button"
                  className="option-row-info"
                  aria-expanded={notesOpen}
                  aria-label={notesOpen ? 'Ascunde notițele' : 'Afișează notițele'}
                  onClick={() => setExpandedNotesId(notesOpen ? null : project.id)}
                >
                  <InfoIcon />
                </button>
              )}
              </div>

              {notes && notesOpen && (
                <div
                  className="option-row-notes"
                  style={
                    hasTint
                      ? { background: tintStyle.background, borderColor: tintStyle.borderColor }
                      : undefined
                  }
                >
                  <span className="option-row-notes-label">Notițe</span>
                  <p className="option-row-notes-text">{notes}</p>
                </div>
              )}
            </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
