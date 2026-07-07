import { ApiError, listActivities } from '@fabxpert/shared';
import type { ActivityDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';

interface ActivitySelectProps {
  onChoose: (activity: ActivityDto) => void;
}

export function ActivitySelect({ onChoose }: ActivitySelectProps) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadActivities = useCallback(async () => {
    setIsLoading(true);
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
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadActivities();
  }, [loadActivities]);

  return (
    <div className="flow-content">
      <p className="flow-step-label">PASUL 2 DIN 2</p>
      <h2 className="flow-heading">Alege activitatea</h2>

      {isLoading && <p className="flow-status">Se încarcă activitățile…</p>}

      {!isLoading && error && (
        <div className="flow-error-block">
          <p className="flow-error-text">{error}</p>
          <button type="button" className="flow-retry-button" onClick={() => void loadActivities()}>
            Reîncearcă
          </button>
        </div>
      )}

      {!isLoading && !error && (
        <ul className="option-list" role="listbox" aria-label="Activități disponibile">
          {activities.map((activity) => (
            <li key={activity.id}>
              <button
                type="button"
                role="option"
                className="option-row option-row-activity"
                onClick={() => onChoose(activity)}
              >
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
