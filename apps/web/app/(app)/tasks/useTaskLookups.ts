'use client';

import {
  formatPersonName,
  listTaskAssignees,
  type ProjectDto,
  type TaskUserDto,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import type { SearchableSelectOption } from '@/components/SearchableSelect';
import { loadAllProjects, toProjectOption } from '../timesheets/projectOptions';

export type TaskLookups = {
  /** Every project, whatever its status — the filter looks through all of them. */
  projects: ProjectDto[];
  projectOptions: SearchableSelectOption[];
  assigneeOptions: SearchableSelectOption[];
  assignees: TaskUserDto[];
  loading: boolean;
};

/** The projects and admins the task filters and forms choose from. */
export function useTaskLookups(): TaskLookups {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [assignees, setAssignees] = useState<TaskUserDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    void Promise.all([loadAllProjects(), listTaskAssignees()])
      .then(([loadedProjects, users]) => {
        if (cancelled) {
          return;
        }
        setProjects(loadedProjects);
        setAssignees(users);
      })
      .catch(() => {
        // The selects stay empty; saving reports the real error.
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const projectOptions = useMemo(() => projects.map(toProjectOption), [projects]);

  const assigneeOptions = useMemo(
    () => assignees.map((user) => ({ id: user.id, label: formatPersonName(user) })),
    [assignees],
  );

  return { projects, projectOptions, assigneeOptions, assignees, loading };
}
