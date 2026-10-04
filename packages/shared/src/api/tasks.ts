import { checkSessionWhenStreamDrops, getApiClientBaseUrl, request } from './client';
import type {
  CreateTaskChecklistItemInput,
  CreateTaskCommentInput,
  CreateTaskInput,
  ListTasksParams,
  ProjectTaskCountsDto,
  TaskAttentionCountResponse,
  TaskDetailDto,
  TaskDto,
  TaskStreamEvent,
  TaskUserDto,
  UpdateTaskChecklistItemInput,
  UpdateTaskInput,
} from '../dto/task.dto';

/** Admin only. Open tasks, plus the finished ones when asked for. */
export function listTasks(params: ListTasksParams = {}) {
  const searchParams = new URLSearchParams();
  if (params.scope) {
    searchParams.set('scope', params.scope);
  }
  if (params.projectId) {
    searchParams.set('projectId', params.projectId);
  }
  if (params.includeDone) {
    searchParams.set('includeDone', 'true');
  }

  const query = searchParams.toString();
  return request<TaskDto[]>(`/tasks${query ? `?${query}` : ''}`);
}

export function getTask(id: string) {
  return request<TaskDetailDto>(`/tasks/${id}`);
}

/** Notifies the assignee, unless they created the task themselves. */
export function createTask(input: CreateTaskInput) {
  return request<TaskDetailDto>('/tasks', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTask(id: string, input: UpdateTaskInput) {
  return request<TaskDetailDto>(`/tasks/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTask(id: string) {
  return request<void>(`/tasks/${id}`, { method: 'DELETE' });
}

/** The admins a task can be assigned to. */
export function listTaskAssignees() {
  return request<TaskUserDto[]>('/tasks/assignees');
}

/** The signed-in user's tasks that are overdue or due today — the sidebar badge. */
export function getTaskAttentionCount() {
  return request<TaskAttentionCountResponse>('/tasks/attention-count');
}

/** Open and overdue tasks of every project that has any. */
export function listProjectTaskCounts() {
  return request<ProjectTaskCountsDto[]>('/tasks/project-counts');
}

export function addTaskChecklistItem(taskId: string, input: CreateTaskChecklistItemInput) {
  return request<TaskDetailDto>(`/tasks/${taskId}/checklist`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateTaskChecklistItem(
  taskId: string,
  itemId: string,
  input: UpdateTaskChecklistItemInput,
) {
  return request<TaskDetailDto>(`/tasks/${taskId}/checklist/${itemId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteTaskChecklistItem(taskId: string, itemId: string) {
  return request<TaskDetailDto>(`/tasks/${taskId}/checklist/${itemId}`, { method: 'DELETE' });
}

export function addTaskComment(taskId: string, input: CreateTaskCommentInput) {
  return request<TaskDetailDto>(`/tasks/${taskId}/comments`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

function isTaskStreamEvent(value: unknown): value is TaskStreamEvent {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.type === 'tasks-changed' || record.type === 'heartbeat') {
    return true;
  }
  return (
    record.type === 'notification' &&
    record.notification !== null &&
    typeof record.notification === 'object'
  );
}

/**
 * The API sends a heartbeat every 30 seconds. A stream silent for this long is
 * dead even if the browser still shows it open — a proxy can keep the
 * connection up after the API behind it restarted.
 */
const STREAM_SILENCE_LIMIT_MS = 75_000;

type TaskStreamHandlers = {
  onEvent: (event: Exclude<TaskStreamEvent, { type: 'heartbeat' }>) => void;
  /**
   * Called every time the stream opens — the first time and after each
   * reconnect. Events sent while it was down are gone, so reload on it.
   */
  onConnected?: () => void;
};

/**
 * Subscribe to live task events (ADMIN SSE stream): list changes for everyone,
 * notifications for the signed-in user only. Reconnects on its own when the
 * stream drops or goes silent.
 * Returns an unsubscribe function that closes the EventSource.
 */
export function subscribeToTasks({ onEvent, onConnected }: TaskStreamHandlers): () => void {
  let source: EventSource | null = null;
  let silenceTimer: ReturnType<typeof setTimeout> | null = null;
  let closed = false;

  function watchForSilence() {
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
    }
    silenceTimer = setTimeout(connect, STREAM_SILENCE_LIMIT_MS);
  }

  function connect() {
    source?.close();
    if (closed) {
      return;
    }

    source = new EventSource(`${getApiClientBaseUrl()}/tasks/stream`, {
      withCredentials: true,
    });
    checkSessionWhenStreamDrops(source);
    watchForSilence();

    source.onopen = () => {
      watchForSilence();
      onConnected?.();
    };

    source.onmessage = (message) => {
      watchForSilence();
      try {
        const parsed: unknown = JSON.parse(message.data);
        if (isTaskStreamEvent(parsed) && parsed.type !== 'heartbeat') {
          onEvent(parsed);
        }
      } catch {
        // Ignore malformed SSE payloads.
      }
    };
  }

  connect();

  return () => {
    closed = true;
    if (silenceTimer !== null) {
      clearTimeout(silenceTimer);
    }
    source?.close();
  };
}
