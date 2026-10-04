import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma, type TaskEventType } from '@prisma/client';
import type { NotificationKind } from '@fabxpert/shared/dto/notification.dto';
import {
  TASK_CHECKLIST_MAX_ITEMS,
  TASK_DONE_LIST_LIMIT,
  type CreateTaskChecklistItemInput,
  type CreateTaskCommentInput,
  type CreateTaskInput,
  type ListTasksParams,
  type ProjectTaskCountsDto,
  type TaskAttentionCountResponse,
  type TaskDetailDto,
  type TaskDto,
  type TaskProjectDto,
  type TaskUserDto,
  type UpdateTaskChecklistItemInput,
  type UpdateTaskInput,
} from '@fabxpert/shared/dto/task.dto';
import { formatPersonName } from '@fabxpert/shared/personName';
import { parseWorkDateString, todayWorkDate, workDateToDayKey } from '@fabxpert/shared/workDate';
import { notDeleted } from '../common/prisma/soft-delete.util';
import { NotificationService } from '../notification/notification.service';
import { PrismaService } from '../prisma/prisma.service';
import { TaskEventsService } from './task-events.service';

const userSelect = {
  id: true,
  person: { select: { firstName: true, lastName: true } },
} satisfies Prisma.UserSelect;

const projectSelect = {
  id: true,
  code: true,
  name: true,
  company: { select: { name: true } },
} satisfies Prisma.ProjectSelect;

const taskInclude = {
  project: { select: projectSelect },
  assignee: { select: userSelect },
  createdBy: { select: userSelect },
  checklistItems: { select: { isDone: true } },
  _count: { select: { comments: true } },
} satisfies Prisma.TaskInclude;

const taskDetailInclude = {
  ...taskInclude,
  checklistItems: { orderBy: { position: 'asc' } },
  comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: userSelect } } },
  // One edit writes its events at the same instant; the type keeps their order steady.
  events: {
    orderBy: [{ createdAt: 'asc' }, { type: 'asc' }],
    include: { actor: { select: userSelect } },
  },
} satisfies Prisma.TaskInclude;

type TaskRow = Prisma.TaskGetPayload<{ include: typeof taskInclude }>;
type TaskDetailRow = Prisma.TaskGetPayload<{ include: typeof taskDetailInclude }>;
type UserRow = Prisma.UserGetPayload<{ select: typeof userSelect }>;
type ProjectRow = Prisma.ProjectGetPayload<{ select: typeof projectSelect }>;

type NewTaskEvent = { type: TaskEventType; fromValue?: string | null; toValue?: string | null };

/** Tasks still on the lists: not removed, on a project that is still there. */
function visibleTaskWhere() {
  return { ...notDeleted(), project: notDeleted() } as const;
}

function toUserDto(user: UserRow): TaskUserDto {
  return { id: user.id, firstName: user.person.firstName, lastName: user.person.lastName };
}

function toProjectDto(project: ProjectRow): TaskProjectDto {
  return {
    id: project.id,
    code: project.code,
    name: project.name,
    companyName: project.company.name,
  };
}

function toDayKey(date: Date | null): string | null {
  return date ? workDateToDayKey(date) : null;
}

/** Blank and missing mean the same thing — store null. */
function normalizeDescription(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function toDto(task: TaskRow | TaskDetailRow): TaskDto {
  return {
    id: task.id,
    title: task.title,
    description: task.description,
    status: task.status,
    priority: task.priority,
    dueDate: toDayKey(task.dueDate),
    completedAt: task.completedAt?.toISOString() ?? null,
    project: toProjectDto(task.project),
    assignee: toUserDto(task.assignee),
    createdBy: toUserDto(task.createdBy),
    checklistDoneCount: task.checklistItems.filter((item) => item.isDone).length,
    checklistTotalCount: task.checklistItems.length,
    commentCount: task._count.comments,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
  };
}

function toDetailDto(task: TaskDetailRow): TaskDetailDto {
  return {
    ...toDto(task),
    checklist: task.checklistItems.map((item) => ({
      id: item.id,
      text: item.text,
      isDone: item.isDone,
      position: item.position,
    })),
    comments: task.comments.map((comment) => ({
      id: comment.id,
      body: comment.body,
      author: toUserDto(comment.author),
      createdAt: comment.createdAt.toISOString(),
    })),
    events: task.events.map((event) => ({
      id: event.id,
      type: event.type,
      fromValue: event.fromValue,
      toValue: event.toValue,
      actor: event.actor ? toUserDto(event.actor) : null,
      createdAt: event.createdAt.toISOString(),
    })),
  };
}

@Injectable()
export class TaskService {
  private readonly logger = new Logger(TaskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly events: TaskEventsService,
  ) {}

  /**
   * Every open task in scope, plus the latest finished ones when asked for.
   * The page filters and groups what it gets — there are never many open.
   */
  async findAll(currentUserId: string, params: ListTasksParams): Promise<TaskDto[]> {
    const where = {
      ...visibleTaskWhere(),
      ...(params.scope === 'mine' ? { assigneeUserId: currentUserId } : {}),
      ...(params.projectId ? { projectId: params.projectId } : {}),
    } satisfies Prisma.TaskWhereInput;

    const [open, done] = await Promise.all([
      this.prisma.task.findMany({
        where: { ...where, status: { not: 'DONE' } },
        include: taskInclude,
        orderBy: { createdAt: 'desc' },
      }),
      params.includeDone
        ? this.prisma.task.findMany({
            where: { ...where, status: 'DONE' },
            include: taskInclude,
            orderBy: { completedAt: 'desc' },
            take: TASK_DONE_LIST_LIMIT,
          })
        : Promise.resolve([]),
    ]);

    return [...open, ...done].map(toDto);
  }

  async findOne(id: string): Promise<TaskDetailDto> {
    return toDetailDto(await this.loadTask(id));
  }

  /** Creates the task and tells the assignee, unless they made it themselves. */
  async create(input: CreateTaskInput, actorUserId: string): Promise<TaskDetailDto> {
    await Promise.all([
      this.assertProjectExists(input.projectId),
      this.assertAssignable(input.assigneeUserId),
    ]);

    const created = await this.prisma.task.create({
      data: {
        title: input.title,
        description: normalizeDescription(input.description),
        priority: input.priority ?? 'NORMAL',
        dueDate: input.dueDate ? parseWorkDateString(input.dueDate) : null,
        projectId: input.projectId,
        assigneeUserId: input.assigneeUserId,
        createdByUserId: actorUserId,
        events: { create: { type: 'CREATED', actorUserId } },
      },
      select: { id: true },
    });

    const task = await this.loadTask(created.id);
    if (task.assigneeUserId !== actorUserId) {
      await this.notify('TASK_ASSIGNED', task.assigneeUserId, actorUserId, task);
    }
    this.events.emitChanged();

    return toDetailDto(task);
  }

  /**
   * Changes a task and writes what moved to its history. A new assignee is
   * told about it, and so is the author when someone else finishes the task;
   * no other edit notifies anyone.
   */
  async update(id: string, input: UpdateTaskInput, actorUserId: string): Promise<TaskDetailDto> {
    const current = await this.loadTask(id);

    const projectChanged = input.projectId !== undefined && input.projectId !== current.projectId;
    const assigneeChanged =
      input.assigneeUserId !== undefined && input.assigneeUserId !== current.assigneeUserId;
    const statusChanged = input.status !== undefined && input.status !== current.status;
    const priorityChanged = input.priority !== undefined && input.priority !== current.priority;
    const currentDueDate = toDayKey(current.dueDate);
    const nextDueDate = input.dueDate === undefined ? currentDueDate : (input.dueDate ?? null);
    const dueDateChanged = nextDueDate !== currentDueDate;

    const [, assignee] = await Promise.all([
      projectChanged ? this.assertProjectExists(input.projectId!) : null,
      assigneeChanged ? this.assertAssignable(input.assigneeUserId!) : null,
    ]);

    const newEvents: NewTaskEvent[] = [];
    if (statusChanged) {
      newEvents.push({ type: 'STATUS_CHANGED', fromValue: current.status, toValue: input.status });
    }
    if (assigneeChanged && assignee) {
      newEvents.push({
        type: 'ASSIGNEE_CHANGED',
        fromValue: formatPersonName(current.assignee.person),
        toValue: formatPersonName(assignee.person),
      });
    }
    if (dueDateChanged) {
      newEvents.push({ type: 'DUE_DATE_CHANGED', fromValue: currentDueDate, toValue: nextDueDate });
    }
    if (priorityChanged) {
      newEvents.push({
        type: 'PRIORITY_CHANGED',
        fromValue: current.priority,
        toValue: input.priority,
      });
    }

    await this.prisma.task.update({
      where: { id },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.description !== undefined
          ? { description: normalizeDescription(input.description) }
          : {}),
        ...(projectChanged ? { projectId: input.projectId } : {}),
        ...(assigneeChanged ? { assigneeUserId: input.assigneeUserId } : {}),
        ...(priorityChanged ? { priority: input.priority } : {}),
        ...(dueDateChanged
          ? { dueDate: nextDueDate ? parseWorkDateString(nextDueDate) : null }
          : {}),
        ...(statusChanged
          ? { status: input.status, completedAt: input.status === 'DONE' ? new Date() : null }
          : {}),
        events: { create: newEvents.map((event) => ({ ...event, actorUserId })) },
      },
    });

    const task = await this.loadTask(id);
    if (assigneeChanged && task.assigneeUserId !== actorUserId) {
      await this.notify('TASK_ASSIGNED', task.assigneeUserId, actorUserId, task);
    }
    if (statusChanged && task.status === 'DONE' && task.createdByUserId !== actorUserId) {
      await this.notify('TASK_COMPLETED', task.createdByUserId, actorUserId, task);
    }
    this.events.emitChanged();

    return toDetailDto(task);
  }

  async remove(id: string): Promise<void> {
    await this.loadTask(id);
    await this.prisma.task.update({ where: { id }, data: { deletedAt: new Date() } });
    this.events.emitChanged();
  }

  /** The admins a task can go to: active accounts only. */
  async findAssignees(): Promise<TaskUserDto[]> {
    const users = await this.prisma.user.findMany({
      where: { ...notDeleted(), role: 'ADMIN', isActive: true },
      select: userSelect,
      orderBy: [{ person: { lastName: 'asc' } }, { person: { firstName: 'asc' } }],
    });
    return users.map(toUserDto);
  }

  /** The user's open tasks that are overdue or due today — the sidebar badge. */
  async countNeedingAttention(userId: string): Promise<TaskAttentionCountResponse> {
    const count = await this.prisma.task.count({
      where: {
        ...visibleTaskWhere(),
        assigneeUserId: userId,
        status: { not: 'DONE' },
        dueDate: { lte: todayWorkDate() },
      },
    });
    return { count };
  }

  /** Open and overdue tasks per project, the projects with overdue ones first. */
  async countByProject(): Promise<ProjectTaskCountsDto[]> {
    const openWhere = { ...visibleTaskWhere(), status: { not: 'DONE' } } as const;

    const [open, overdue] = await Promise.all([
      this.prisma.task.groupBy({ by: ['projectId'], where: openWhere, _count: { _all: true } }),
      this.prisma.task.groupBy({
        by: ['projectId'],
        where: { ...openWhere, dueDate: { lt: todayWorkDate() } },
        _count: { _all: true },
      }),
    ]);
    if (open.length === 0) {
      return [];
    }

    const projects = await this.prisma.project.findMany({
      where: { id: { in: open.map((row) => row.projectId) } },
      select: projectSelect,
    });
    const projectById = new Map(projects.map((project) => [project.id, toProjectDto(project)]));
    const overdueByProject = new Map(overdue.map((row) => [row.projectId, row._count._all]));

    return open
      .flatMap((row) => {
        const project = projectById.get(row.projectId);
        return project
          ? [
              {
                project,
                openCount: row._count._all,
                overdueCount: overdueByProject.get(row.projectId) ?? 0,
              },
            ]
          : [];
      })
      .sort(
        (a, b) =>
          b.overdueCount - a.overdueCount ||
          b.openCount - a.openCount ||
          a.project.code.localeCompare(b.project.code),
      );
  }

  async addChecklistItem(
    taskId: string,
    input: CreateTaskChecklistItemInput,
  ): Promise<TaskDetailDto> {
    const task = await this.loadTask(taskId);
    if (task.checklistItems.length >= TASK_CHECKLIST_MAX_ITEMS) {
      throw new BadRequestException(
        `A checklist cannot have more than ${TASK_CHECKLIST_MAX_ITEMS} items`,
      );
    }

    const lastPosition = task.checklistItems.at(-1)?.position ?? -1;
    await this.prisma.taskChecklistItem.create({
      data: { taskId, text: input.text, position: lastPosition + 1 },
    });

    return this.reloadAfterChange(taskId);
  }

  async updateChecklistItem(
    taskId: string,
    itemId: string,
    input: UpdateTaskChecklistItemInput,
  ): Promise<TaskDetailDto> {
    await this.loadTask(taskId);
    const { count } = await this.prisma.taskChecklistItem.updateMany({
      where: { id: itemId, taskId },
      data: {
        ...(input.text !== undefined ? { text: input.text } : {}),
        ...(input.isDone !== undefined ? { isDone: input.isDone } : {}),
      },
    });
    if (count === 0) {
      throw new NotFoundException(`Checklist item with id ${itemId} not found`);
    }

    return this.reloadAfterChange(taskId);
  }

  async removeChecklistItem(taskId: string, itemId: string): Promise<TaskDetailDto> {
    await this.loadTask(taskId);
    const { count } = await this.prisma.taskChecklistItem.deleteMany({
      where: { id: itemId, taskId },
    });
    if (count === 0) {
      throw new NotFoundException(`Checklist item with id ${itemId} not found`);
    }

    return this.reloadAfterChange(taskId);
  }

  async addComment(
    taskId: string,
    input: CreateTaskCommentInput,
    actorUserId: string,
  ): Promise<TaskDetailDto> {
    await this.loadTask(taskId);
    await this.prisma.taskComment.create({
      data: { taskId, body: input.body, authorUserId: actorUserId },
    });

    return this.reloadAfterChange(taskId);
  }

  /** The counters on the list rows moved, so the open lists reload too. */
  private async reloadAfterChange(taskId: string): Promise<TaskDetailDto> {
    const task = await this.loadTask(taskId);
    this.events.emitChanged();
    return toDetailDto(task);
  }

  private async loadTask(id: string): Promise<TaskDetailRow> {
    const task = await this.prisma.task.findFirst({
      where: { id, ...visibleTaskWhere() },
      include: taskDetailInclude,
    });
    if (!task) {
      throw new NotFoundException(`Task with id ${id} not found`);
    }
    return task;
  }

  private async assertProjectExists(projectId: string): Promise<void> {
    const project = await this.prisma.project.findFirst({
      where: { id: projectId, ...notDeleted() },
      select: { id: true },
    });
    if (!project) {
      throw new BadRequestException(`Project with id ${projectId} not found`);
    }
  }

  /** Tasks go to admins only — they are the ones who can open them. */
  private async assertAssignable(userId: string): Promise<UserRow> {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, ...notDeleted(), role: 'ADMIN', isActive: true },
      select: userSelect,
    });
    if (!user) {
      throw new BadRequestException('The assignee must be an active admin');
    }
    return user;
  }

  /**
   * Stores the notification and hands it to the recipient's open apps. The
   * task is already saved by now, so a failure here is logged, never thrown —
   * an error would make the admin create the task a second time.
   */
  private async notify(
    kind: Extract<NotificationKind, 'TASK_ASSIGNED' | 'TASK_COMPLETED'>,
    recipientUserId: string,
    actorUserId: string,
    task: TaskDetailRow,
  ): Promise<void> {
    try {
      const actor = await this.prisma.user.findUnique({
        where: { id: actorUserId },
        select: userSelect,
      });
      const actorName = actor ? formatPersonName(actor.person) : 'Un coleg';

      const notification = await this.notifications.create({
        userId: recipientUserId,
        kind,
        source: 'ADMIN',
        createdByUserId: actorUserId,
        taskId: task.id,
        title:
          kind === 'TASK_ASSIGNED'
            ? `${actorName} ți-a atribuit un task`
            : `${actorName} a finalizat un task`,
        body: `${task.title} · ${task.project.code}`,
      });
      this.events.emitNotification(recipientUserId, notification);
    } catch (error) {
      this.logger.error(
        `Could not notify user ${recipientUserId} about task ${task.id}`,
        error instanceof Error ? error.stack : String(error),
      );
    }
  }
}
