import { request } from './client';
import type {
  AssemblyImportResult,
  AssemblyListStatus,
  AssemblyPreviewDto,
  CreateProjectAssemblyInput,
  ImportProjectAssembliesInput,
  ProjectAssemblyDto,
  UpdateProjectAssemblyInput,
} from '../dto/assembly.dto';

export type ListProjectAssembliesParams = {
  /** Scopes `status` and is what the mobile picker filters by. */
  activityId?: string;
  /** `pending` and `completed` need an activityId; without one they are ignored. */
  status?: AssemblyListStatus;
  search?: string;
};

export function listProjectAssemblies(
  projectId: string,
  params: ListProjectAssembliesParams = {},
) {
  const searchParams = new URLSearchParams();
  if (params.activityId) {
    searchParams.set('activityId', params.activityId);
  }
  if (params.status) {
    searchParams.set('status', params.status);
  }
  if (params.search) {
    searchParams.set('search', params.search);
  }
  const query = searchParams.toString();

  return request<ProjectAssemblyDto[]>(
    `/projects/${projectId}/assemblies${query ? `?${query}` : ''}`,
  );
}

export function createProjectAssembly(projectId: string, input: CreateProjectAssemblyInput) {
  return request<ProjectAssemblyDto>(`/projects/${projectId}/assemblies`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function importProjectAssemblies(
  projectId: string,
  input: ImportProjectAssembliesInput,
) {
  return request<AssemblyImportResult>(`/projects/${projectId}/assemblies/import`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProjectAssembly(id: string, input: UpdateProjectAssemblyInput) {
  return request<ProjectAssemblyDto>(`/assemblies/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProjectAssembly(id: string) {
  return request<void>(`/assemblies/${id}`, { method: 'DELETE' });
}

/**
 * Read a pasted list without saving it. Not tied to a project: one being
 * created has no id yet, and its list still has to be shown before it is saved.
 */
export function previewAssembliesFromText(tsv: string) {
  return request<AssemblyPreviewDto>('/assemblies/preview/text', {
    method: 'POST',
    body: JSON.stringify({ tsv }),
  });
}

/** Same, from a workbook. `sheet` overrules the detected one. */
export function previewAssembliesFromFile(file: File, sheet?: string) {
  const form = new FormData();
  form.append('file', file);
  if (sheet) {
    form.append('sheet', sheet);
  }

  return request<AssemblyPreviewDto>('/assemblies/preview/file', {
    method: 'POST',
    body: form,
  });
}
