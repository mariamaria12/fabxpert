import { listProjects, type ProjectDto } from '@fabxpert/shared';
import type { SearchableSelectOption } from '@/components/SearchableSelect';
import { loadAllPages } from '@/utils/loadAllPages';

export function projectOptionLabel(project: {
  code: string;
  name: string;
  company: { name: string };
}): string {
  return project.company.name
    ? `${project.code || project.name} - ${project.company.name}`
    : project.code || project.name;
}

/** A project in a searchable list: found by code, client or work description. */
export function toProjectOption(project: ProjectDto): SearchableSelectOption {
  return {
    id: project.id,
    label: projectOptionLabel(project),
    description: project.denumireLucrare ?? undefined,
  };
}

/** Every project, whatever its status — old pontaje point at finished ones too. */
export function loadAllProjects(): Promise<ProjectDto[]> {
  return loadAllPages((page, pageSize) => listProjects({ page, pageSize, compact: true }));
}
