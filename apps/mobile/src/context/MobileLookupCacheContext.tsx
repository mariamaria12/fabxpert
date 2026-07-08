import {
  ApiError,
  listActivities,
  listAvailableProjects,
  subscribeToAvailableProjects,
} from '@fabxpert/shared';
import type { ActivityDto, ProjectOptionDto } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';

function apiErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && caught.status === 0) {
    return 'Nu s-a putut contacta serverul.';
  }
  return fallback;
}

interface MobileLookupCacheContextValue {
  activities: ActivityDto[];
  activitiesError: string | null;
  isFetchingActivities: boolean;
  refreshActivities: () => Promise<void>;

  projects: ProjectOptionDto[];
  projectsError: string | null;
  isFetchingProjects: boolean;
  refreshProjects: (options?: { silent?: boolean }) => Promise<void>;
}

const MobileLookupCacheContext = createContext<MobileLookupCacheContextValue | null>(null);

export function MobileLookupCacheProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [isFetchingActivities, setIsFetchingActivities] = useState(true);

  const [projects, setProjects] = useState<ProjectOptionDto[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isFetchingProjects, setIsFetchingProjects] = useState(true);

  const projectsDebounceRef = useRef<number | null>(null);

  const refreshActivities = useCallback(async () => {
    setIsFetchingActivities(true);
    setActivitiesError(null);

    try {
      const data = await listActivities();
      setActivities(data);
    } catch (caught) {
      setActivitiesError(apiErrorMessage(caught, 'Nu s-au putut încărca activitățile.'));
    } finally {
      setIsFetchingActivities(false);
    }
  }, []);

  const refreshProjects = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;

    if (!silent) {
      setIsFetchingProjects(true);
      setProjectsError(null);
    }

    try {
      const data = await listAvailableProjects();
      setProjects(data);
      if (!silent) {
        setProjectsError(null);
      }
    } catch (caught) {
      if (!silent) {
        setProjectsError(apiErrorMessage(caught, 'Nu s-au putut încărca proiectele.'));
      }
    } finally {
      if (!silent) {
        setIsFetchingProjects(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshActivities();
    void refreshProjects();
  }, [refreshActivities, refreshProjects]);

  useEffect(() => {
    const unsubscribe = subscribeToAvailableProjects(() => {
      if (projectsDebounceRef.current !== null) {
        window.clearTimeout(projectsDebounceRef.current);
      }

      projectsDebounceRef.current = window.setTimeout(() => {
        void refreshProjects({ silent: true });
        projectsDebounceRef.current = null;
      }, 1000);
    });

    return () => {
      unsubscribe();
      if (projectsDebounceRef.current !== null) {
        window.clearTimeout(projectsDebounceRef.current);
      }
    };
  }, [refreshProjects]);

  return (
    <MobileLookupCacheContext.Provider
      value={{
        activities,
        activitiesError,
        isFetchingActivities,
        refreshActivities,
        projects,
        projectsError,
        isFetchingProjects,
        refreshProjects,
      }}
    >
      {children}
    </MobileLookupCacheContext.Provider>
  );
}

export function useMobileLookupCache(): MobileLookupCacheContextValue {
  const value = useContext(MobileLookupCacheContext);
  if (value === null) {
    throw new Error('useMobileLookupCache must be used within MobileLookupCacheProvider');
  }
  return value;
}
