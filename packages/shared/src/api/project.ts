import { getApiClientBaseUrl, request } from './client';
import type {
  CreateProjectInput,
  ProjectDto,
  ProjectOptionDto,
  ProjectListSortBy,
  ProjectStatus,
  ProjectStatusGroup,
  SortOrder,
  UpdateProjectInput,
} from '../dto/project.dto';
import type { PaginatedResponse } from '../dto/pagination.dto';

export type { ProjectStatusGroup };

export type ProjectAvailabilityEvent = {
  type: 'available-projects-changed';
};

export function listAvailableProjects() {
  return request<ProjectOptionDto[]>('/projects/available');
}

export interface ListProjectsParams {
  page?: number;
  pageSize?: number;
  search?: string;
  /** One or more project statuses (OR filter). */
  status?: ProjectStatus | ProjectStatus[];
  statusGroup?: ProjectStatusGroup;
  /**
   * Visibility filter values:
   * - `everyone` → projects with no role restriction ("Toți")
   * - role UUID → projects that include that role
   * - multiple values → OR
   */
  visibleFor?: Array<'everyone' | string>;
  /** When set, filter by `readyForExecution` flag. */
  readyForExecution?: boolean;
  sortBy?: ProjectListSortBy;
  sortOrder?: SortOrder;
  /** Omit role visibility join — faster for read-only lists (Panou, lookups). */
  compact?: boolean;
}

export function listProjects(params: ListProjectsParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.page !== undefined) {
    searchParams.set('page', String(params.page));
  }
  if (params.pageSize !== undefined) {
    searchParams.set('pageSize', String(params.pageSize));
  }
  const trimmedSearch = params.search?.trim();
  if (trimmedSearch) {
    searchParams.set('search', trimmedSearch);
  }
  if (params.status) {
    const statuses = Array.isArray(params.status) ? params.status : [params.status];
    if (statuses.length > 0) {
      searchParams.set('status', statuses.join(','));
    }
  }
  if (params.statusGroup) {
    searchParams.set('statusGroup', params.statusGroup);
  }
  if (params.visibleFor && params.visibleFor.length > 0) {
    searchParams.set('visibleFor', params.visibleFor.join(','));
  }
  if (params.readyForExecution !== undefined) {
    searchParams.set('readyForExecution', params.readyForExecution ? 'true' : 'false');
  }
  if (params.sortBy) {
    searchParams.set('sortBy', params.sortBy);
  }
  if (params.sortOrder) {
    searchParams.set('sortOrder', params.sortOrder);
  }
  if (params.compact) {
    searchParams.set('compact', 'true');
  }
  const query = searchParams.toString();
  return request<PaginatedResponse<ProjectDto>>(`/projects${query ? `?${query}` : ''}`);
}

export function getProject(id: string) {
  return request<ProjectDto>(`/projects/${id}`);
}

export function createProject(input: CreateProjectInput) {
  return request<ProjectDto>('/projects', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateProject(id: string, input: UpdateProjectInput) {
  return request<ProjectDto>(`/projects/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteProject(id: string) {
  return request<void>(`/projects/${id}`, { method: 'DELETE' });
}

export function reorderPinnedProjects(columns: [string[], string[]]) {
  return request<void>('/projects/pinned-order', {
    method: 'PATCH',
    body: JSON.stringify({ columns }),
  });
}

function isProjectAvailabilityEvent(value: unknown): value is ProjectAvailabilityEvent {
  return (
    value !== null &&
    typeof value === 'object' &&
    (value as ProjectAvailabilityEvent).type === 'available-projects-changed'
  );
}

/**
 * Subscribe to project availability change signals (ADMIN + EMPLOYEE SSE stream).
 * Calls onEvent when the employee-visible project set may have changed.
 */
export function subscribeToAvailableProjects(
  onEvent: () => void,
  onError?: (error: Event) => void,
): () => void {
  const source = new EventSource(`${getApiClientBaseUrl()}/projects/available/stream`, {
    withCredentials: true,
  });

  source.onmessage = (message) => {
    try {
      const parsed: unknown = JSON.parse(message.data);
      if (isProjectAvailabilityEvent(parsed)) {
        onEvent();
      }
    } catch {
      // Ignore malformed SSE payloads and heartbeats.
    }
  };

  source.onerror = (error) => {
    onError?.(error);
  };

  return () => {
    source.close();
  };
}
