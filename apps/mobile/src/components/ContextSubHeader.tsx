interface ContextSubHeaderProps {
  projectCode: string;
  companyName?: string | null;
  projectColor: string | null;
  activityName?: string | null;
  showBack?: boolean;
  onBack?: () => void;
}

export function ContextSubHeader({
  projectCode,
  companyName,
  projectColor,
  activityName,
  showBack = true,
  onBack,
}: ContextSubHeaderProps) {
  return (
    <div className="context-subheader">
      {showBack && onBack ? (
        <button
          type="button"
          className="context-subheader-back"
          aria-label="Înapoi"
          onClick={onBack}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      ) : (
        <span className="context-subheader-back-spacer" aria-hidden="true" />
      )}

      <div className="context-subheader-text">
        <div className="context-subheader-project">
          <span
            className="context-subheader-color-bar"
            style={{ background: projectColor ?? 'var(--color-border)' }}
            aria-hidden="true"
          />
          <div className="context-subheader-project-text">
            <span className="context-subheader-project-code">{projectCode}</span>
            {companyName ? (
              <span className="context-subheader-company">{companyName}</span>
            ) : null}
          </div>
        </div>
        {activityName ? (
          <p className="context-subheader-activity">{activityName}</p>
        ) : null}
      </div>
    </div>
  );
}
