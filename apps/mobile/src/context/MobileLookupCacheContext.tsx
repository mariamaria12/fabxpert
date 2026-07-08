import {
  ApiError,
  listActivities,
  listAvailableProjects,
  listMyTimesheets,
  subscribeToAvailableProjects,
} from '@fabxpert/shared';
import type { ActivityDto, PaginatedResponse, ProjectOptionDto, TimesheetDto } from '@fabxpert/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { sumTodayClosedMinutes } from '../utils/timeUtils';

function apiErrorMessage(caught: unknown, fallback: string): string {
  if (caught instanceof ApiError && caught.status === 0) {
    return 'Nu s-a putut contacta serverul.';
  }
  return fallback;
}

let myTimesheetsPage1Inflight: Promise<PaginatedResponse<TimesheetDto>> | null = null;

function fetchMyTimesheetsPage1(force = false): Promise<PaginatedResponse<TimesheetDto>> {
  if (force) {
    myTimesheetsPage1Inflight = null;
  }

  if (!myTimesheetsPage1Inflight) {
    myTimesheetsPage1Inflight = listMyTimesheets(1).finally(() => {
      myTimesheetsPage1Inflight = null;
    });
  }

  return myTimesheetsPage1Inflight;
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

  myTimesheetsPage1: PaginatedResponse<TimesheetDto> | null;
  myTimesheetsPage1Error: string | null;
  myTimesheetsPage1Loaded: boolean;
  isFetchingMyTimesheetsPage1: boolean;
  refreshMyTimesheetsPage1: (options?: { silent?: boolean; force?: boolean }) => Promise<void>;

  todayMinutes: number;
}

const MobileLookupCacheContext = createContext<MobileLookupCacheContextValue | null>(null);

export function MobileLookupCacheProvider({ children }: { children: ReactNode }) {
  const [activities, setActivities] = useState<ActivityDto[]>([]);
  const [activitiesError, setActivitiesError] = useState<string | null>(null);
  const [isFetchingActivities, setIsFetchingActivities] = useState(true);

  const [projects, setProjects] = useState<ProjectOptionDto[]>([]);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [isFetchingProjects, setIsFetchingProjects] = useState(true);

  const [myTimesheetsPage1, setMyTimesheetsPage1] =
    useState<PaginatedResponse<TimesheetDto> | null>(null);
  const [myTimesheetsPage1Error, setMyTimesheetsPage1Error] = useState<string | null>(null);
  const [myTimesheetsPage1Loaded, setMyTimesheetsPage1Loaded] = useState(false);
  const [isFetchingMyTimesheetsPage1, setIsFetchingMyTimesheetsPage1] = useState(true);
  const [todayMinutes, setTodayMinutes] = useState(0);

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

  const refreshMyTimesheetsPage1 = useCallback(async (options?: { silent?: boolean; force?: boolean }) => {
    const silent = options?.silent === true;
    const force = options?.force === true;

    if (!silent) {
      setIsFetchingMyTimesheetsPage1(true);
      setMyTimesheetsPage1Error(null);
    }

    try {
      const response = await fetchMyTimesheetsPage1(force);
      setMyTimesheetsPage1(response);
      setTodayMinutes(sumTodayClosedMinutes(response.data));
      setMyTimesheetsPage1Error(null);
    } catch (caught) {
      setMyTimesheetsPage1Error(
        apiErrorMessage(caught, 'Nu s-au putut încărca pontajele.'),
      );
      setTodayMinutes((current) => current);
    } finally {
      setMyTimesheetsPage1Loaded(true);
      if (!silent) {
        setIsFetchingMyTimesheetsPage1(false);
      }
    }
  }, []);

  useEffect(() => {
    void refreshActivities();
    void refreshProjects();
    void refreshMyTimesheetsPage1();
  }, [refreshActivities, refreshProjects, refreshMyTimesheetsPage1]);

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
        myTimesheetsPage1,
        myTimesheetsPage1Error,
        myTimesheetsPage1Loaded,
        isFetchingMyTimesheetsPage1,
        refreshMyTimesheetsPage1,
        todayMinutes,
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
