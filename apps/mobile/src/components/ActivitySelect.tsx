import type { ActivityDto } from '@fabxpert/shared';
import { ActivityListSkeleton } from './skeletons/OptionListSkeleton';
import { useMobileLookupCache } from '../context/MobileLookupCacheContext';
import { ActivityDot } from './ActivityDot';

interface ActivitySelectProps {
  onChoose: (activity: ActivityDto) => void;
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

export function ActivitySelect({ onChoose }: ActivitySelectProps) {
  const {
    activities,
    activitiesError,
    isFetchingActivities,
    refreshActivities,
  } = useMobileLookupCache();

  const showSkeleton = isFetchingActivities && activities.length === 0 && !activitiesError;
  const showList = !activitiesError && activities.length > 0;
  const showError = !isFetchingActivities && Boolean(activitiesError);
  const showEmpty = !isFetchingActivities && !activitiesError && activities.length === 0;

  return (
    <div className="flow-content">
      <p className="flow-step-label">PASUL 2 DIN 2</p>
      <div className="flow-heading-row">
        <h2 className="flow-heading">Alege activitatea</h2>
        <button
          type="button"
          className="flow-refresh-button"
          onClick={() => void refreshActivities()}
          disabled={isFetchingActivities}
          aria-label="Reîmprospătează activitățile"
          aria-busy={isFetchingActivities}
        >
          <RefreshIcon spinning={isFetchingActivities} />
        </button>
      </div>

      {showSkeleton && <ActivityListSkeleton />}

      {showError && (
        <div className="flow-error-block">
          <p className="flow-error-text">{activitiesError}</p>
          <button type="button" className="flow-retry-button" onClick={() => void refreshActivities()}>
            Reîncearcă
          </button>
        </div>
      )}

      {showEmpty && <p className="flow-status">Nu există activități disponibile.</p>}

      {showList && (
        <ul className="option-list" role="listbox" aria-label="Activități disponibile">
          {activities.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                role="option"
                className="option-row option-row-activity"
                onClick={() => onChoose(activity)}
              >
                <ActivityDot color={activity.color} />
                <span className="option-row-body">
                  <span className="option-row-title">{activity.name}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
