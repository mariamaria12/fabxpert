import { ApiError, listActivities } from '@fabxpert/shared';
import type { ActivityDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { ActivityListSkeleton } from './skeletons/OptionListSkeleton';
import { ActivityDot } from './ActivityDot';

interface ActivitySelectProps {
  onChoose: (activity: ActivityDto) => void;
}

export function ActivitySelect({ onChoose }: ActivitySelectProps) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const showSkeleton = isFetching && activities.length === 0 && !error;

  const loadActivities = useCallback(async () => {
    setIsFetching(true);
    setError(null);

    try {
      const data = await listActivities();
      setActivities(data);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setError('Nu s-a putut contacta serverul.');
      } else {
        setError('Nu s-au putut încărca activitățile.');
      }
    } finally {
      setIsFetching(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  const showList = !error && activities.length > 0;
  const showError = !isFetching && Boolean(error);
  const showEmpty = !isFetching && !error && activities.length === 0;

  return (
    <div className="flow-content">
      <p className="flow-step-label">PASUL 2 DIN 2</p>
      <h2 className="flow-heading">Alege activitatea</h2>

      {showSkeleton && <ActivityListSkeleton />}

      {showError && (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button type="button" className="flow-retry-button" onClick={() => void loadActivities()}>
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
