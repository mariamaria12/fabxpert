import type { ProjectAssemblyDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { listProjectAssemblies } from '../impersonationApi';

export type ProjectAssembliesState = {
  assemblies: ProjectAssemblyDto[];
  isLoading: boolean;
  /** True once a fetch for this project has finished, successfully or not. */
  isLoaded: boolean;
  error: string | null;
  reload: () => void;
};

/**
 * The project's assembly list, fetched as soon as a project is picked. Loading
 * it while the worker is still choosing the activity is what keeps the picker
 * from flashing on projects that have no list at all.
 */
export function useProjectAssemblies(projectId: string | null): ProjectAssembliesState {
  const [assemblies, setAssemblies] = useState<ProjectAssemblyDto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const reload = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    if (!projectId) {
      setAssemblies([]);
      setIsLoading(false);
      setIsLoaded(false);
      setError(null);
      return;
    }

    let active = true;
    setIsLoading(true);
    setIsLoaded(false);
    setError(null);

    listProjectAssemblies(projectId)
      .then((data) => {
        if (active) {
          setAssemblies(data);
        }
      })
      .catch(() => {
        if (active) {
          setAssemblies([]);
          setError('Nu s-au putut încărca ansamblele.');
        }
      })
      .finally(() => {
        if (active) {
          setIsLoading(false);
          setIsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [projectId, reloadToken]);

  return { assemblies, isLoading, isLoaded, error, reload };
}
