import { z } from 'zod';
import { isCalendarDateString } from '../workDate';
import type { NotificationDto } from './notification.dto';

export const TASK_STATUS_VALUES = ['TODO', 'IN_PROGRESS', 'DONE'] as const;
export type TaskStatus = (typeof TASK_STATUS_VALUES)[number];

export const TASK_PRIORITY_VALUES = ['NORMAL', 'HIGH', 'URGENT'] as const;
export type TaskPriority = (typeof TASK_PRIORITY_VALUES)[number];

export const TASK_EVENT_TYPE_VALUES = [
  'CREATED',
  'STATUS_CHANGED',
  'ASSIGNEE_CHANGED',
  'DUE_DATE_CHANGED',
  'PRIORITY_CHANGED',
] as const;
export type TaskEventType = (typeof TASK_EVENT_TYPE_VALUES)[number];

export const TASK_TITLE_MAX_LENGTH = 200;
export const TASK_DESCRIPTION_MAX_LENGTH = 5000;
export const TASK_CHECKLIST_TEXT_MAX_LENGTH = 200;
export const TASK_CHECKLIST_MAX_ITEMS = 50;
export const TASK_COMMENT_MAX_LENGTH = 2000;
/** Finished tasks pile up for good; a list only ever carries the latest. */
export const TASK_DONE_LIST_LIMIT = 100;

const idSchema = z.string().trim().min(1);

const taskDateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD')
  .refine(isCalendarDateString, 'Date must be a real calendar day');

const titleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(TASK_TITLE_MAX_LENGTH, `Title cannot exceed ${TASK_TITLE_MAX_LENGTH} characters`);

const descriptionSchema = z
  .string()
  .trim()
  .max(
    TASK_DESCRIPTION_MAX_LENGTH,
    `Description cannot exceed ${TASK_DESCRIPTION_MAX_LENGTH} characters`,
  );

/** Only the title, the project and the assignee are required. */
export const createTaskSchema = z.object({
  title: titleSchema,
  projectId: idSchema,
  assigneeUserId: idSchema,
  /** Calendar day, `YYYY-MM-DD`. Omit or null for a task with no deadline. */
  dueDate: taskDateSchema.nullish(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  description: descriptionSchema.optional(),
});

export const updateTaskSchema = z.object({
  title: titleSchema.optional(),
  projectId: idSchema.optional(),
  assigneeUserId: idSchema.optional(),
  dueDate: taskDateSchema.nullish(),
  priority: z.enum(TASK_PRIORITY_VALUES).optional(),
  status: z.enum(TASK_STATUS_VALUES).optional(),
  /** Null or blank clears it. */
  description: descriptionSchema.nullish(),
});

const checklistTextSchema = z
  .string()
  .trim()
  .min(1, 'Text is required')
  .max(
    TASK_CHECKLIST_TEXT_MAX_LENGTH,
    `Text cannot exceed ${TASK_CHECKLIST_TEXT_MAX_LENGTH} characters`,
  );

export const createTaskChecklistItemSchema = z.object({ text: checklistTextSchema });

export const updateTaskChecklistItemSchema = z.object({
  text: checklistTextSchema.optional(),
  isDone: z.boolean().optional(),
});

export const createTaskCommentSchema = z.object({
  body: z
    .string()
    .trim()
    .min(1, 'Comment is required')
    .max(TASK_COMMENT_MAX_LENGTH, `Comment cannot exceed ${TASK_COMMENT_MAX_LENGTH} characters`),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type CreateTaskChecklistItemInput = z.infer<typeof createTaskChecklistItemSchema>;
export type UpdateTaskChecklistItemInput = z.infer<typeof updateTaskChecklistItemSchema>;
export type CreateTaskCommentInput = z.infer<typeof createTaskCommentSchema>;

/** An admin as tasks show them: the user id, with the person's name. */
export interface TaskUserDto {
  id: string;
  firstName: string;
  lastName: string;
}

export interface TaskProjectDto {
  id: string;
  code: string;
  name: string;
  /** The client the project is for. */
  companyName: string;
}

export interface TaskDto {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  /** Calendar day, `YYYY-MM-DD`; null when the task has no deadline. */
  dueDate: string | null;
  completedAt: string | null;
  project: TaskProjectDto;
  assignee: TaskUserDto;
  createdBy: TaskUserDto;
  checklistDoneCount: number;
  checklistTotalCount: number;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskChecklistItemDto {
  id: string;
  text: string;
  isDone: boolean;
  position: number;
}

export interface TaskCommentDto {
  id: string;
  body: string;
  author: TaskUserDto;
  createdAt: string;
}

export interface TaskEventDto {
  id: string;
  type: TaskEventType;
  /** A status, a priority, a `YYYY-MM-DD` day or a name, depending on `type`. */
  fromValue: string | null;
  toValue: string | null;
  /** Null when the app raised the event on its own. */
  actor: TaskUserDto | null;
  createdAt: string;
}

/** A task with everything its drawer shows. */
export interface TaskDetailDto extends TaskDto {
  checklist: TaskChecklistItemDto[];
  comments: TaskCommentDto[];
  events: TaskEventDto[];
}

export const TASK_LIST_SCOPE_VALUES = ['mine', 'all'] as const;
export type TaskListScope = (typeof TASK_LIST_SCOPE_VALUES)[number];

export interface ListTasksParams {
  /** `mine` keeps the tasks assigned to the signed-in user. Defaults to `all`. */
  scope?: TaskListScope;
  projectId?: string;
  /** Finished tasks are left out unless asked for; then the latest TASK_DONE_LIST_LIMIT come along. */
  includeDone?: boolean;
}

/** The signed-in user's open tasks that are overdue or due today. */
export interface TaskAttentionCountResponse {
  count: number;
}

/** A project's open tasks, for the counters next to it. */
export interface ProjectTaskCountsDto {
  project: TaskProjectDto;
  openCount: number;
  overdueCount: number;
}

/** What the live stream sends to an admin's open app. */
export type TaskStreamEvent =
  /** A task was created, changed or removed — lists should reload. */
  | { type: 'tasks-changed' }
  /** A notification for this user only. */
  | { type: 'notification'; notification: NotificationDto }
  /** Sent on a timer so a dead connection can be told from a quiet one. */
  | { type: 'heartbeat' };
