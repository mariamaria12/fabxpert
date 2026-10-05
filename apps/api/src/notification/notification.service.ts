import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { NotificationKind, NotificationSource, Prisma } from '@prisma/client';
import type {
  NotificationDto,
  NotificationInboxResponse,
  PushSubscriptionInput,
} from '@fabxpert/shared/dto/notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';
import { formatPersonName } from '@fabxpert/shared/personName';

type NotificationWithAuthor = Prisma.NotificationGetPayload<{
  include: { createdBy: { include: { person: true } } };
}>;

export type CreateNotificationParams = {
  userId: string;
  kind: NotificationKind;
  title: string;
  body: string;
  source?: NotificationSource;
  createdByUserId?: string;
  /** Set on POLL notifications so answering can clear this exact nudge. */
  pollId?: string;
  /** Set on TASK_* notifications — the task the inbox opens. */
  taskId?: string;
  /**
   * Leaves the push to finish on its own. For a caller answering a request
   * that is already saved: a slow push service must not hold the answer back.
   */
  pushInBackground?: boolean;
};

/** What the web inbox lists: the task notifications, which only admins get. */
const INBOX_KINDS: NotificationKind[] = ['TASK_ASSIGNED', 'TASK_COMPLETED', 'TASK_COMMENTED'];
const INBOX_LIMIT = 30;

/** A notification about a removed task, or one on a removed project, has nothing left to open. */
function inboxWhere(userId: string) {
  return {
    userId,
    kind: { in: INBOX_KINDS },
    dismissedAt: null,
    task: { deletedAt: null, project: { deletedAt: null } },
  } satisfies Prisma.NotificationWhereInput;
}

function toDto(notification: NotificationWithAuthor): NotificationDto {
  const person = notification.createdBy?.person;
  return {
    id: notification.id,
    kind: notification.kind,
    source: notification.source,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    createdByName: person ? formatPersonName(person) : null,
    pollId: notification.pollId,
    taskId: notification.taskId,
    readAt: notification.readAt?.toISOString() ?? null,
  };
}

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  /** Undismissed notifications, newest first — what the app shows on open. */
  async listForUser(userId: string): Promise<NotificationDto[]> {
    const notifications = await this.prisma.notification.findMany({
      where: { userId, dismissedAt: null },
      include: { createdBy: { include: { person: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return notifications.map(toDto);
  }

  /** Stores the notification and pushes it to the user's devices. */
  async create(params: CreateNotificationParams): Promise<NotificationDto> {
    const {
      userId,
      kind,
      title,
      body,
      source = 'SYSTEM',
      createdByUserId,
      pollId,
      taskId,
      pushInBackground = false,
    } = params;

    const created = await this.prisma.notification.create({
      data: { userId, kind, title, body, source, createdByUserId, pollId, taskId },
      include: { createdBy: { include: { person: true } } },
    });

    const pushed = this.push.sendToUser(userId, { title, body, tag: created.id });
    if (pushInBackground) {
      void pushed.catch((error: unknown) => {
        this.logger.warn(
          `Push failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
        );
      });
    } else {
      await pushed;
    }

    return toDto(created);
  }

  /** The latest task notifications for the bell, read ones included. */
  async inboxForUser(userId: string): Promise<NotificationInboxResponse> {
    const where = inboxWhere(userId);
    const [notifications, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        include: { createdBy: { include: { person: true } } },
        orderBy: { createdAt: 'desc' },
        take: INBOX_LIMIT,
      }),
      this.prisma.notification.count({ where: { ...where, readAt: null } }),
    ]);

    return { notifications: notifications.map(toDto), unreadCount };
  }

  /** Marks one notification as seen. Idempotent — the first read time is kept. */
  async markRead(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    await this.prisma.notification.updateMany({
      where: { id: notificationId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async markInboxRead(userId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: { ...inboxWhere(userId), readAt: null },
      data: { readAt: new Date() },
    });
  }

  /**
   * Same notification to many users at once. One insert for the whole batch —
   * a per-user create would mean one round trip per employee, which is what
   * made publishing a poll feel stuck.
   */
  async createForUsers(
    params: Omit<CreateNotificationParams, 'userId'> & { userIds: string[] },
  ): Promise<number> {
    const { userIds, kind, title, body, source = 'SYSTEM', createdByUserId, pollId } = params;
    if (userIds.length === 0) {
      return 0;
    }

    await this.prisma.notification.createMany({
      data: userIds.map((userId) => ({
        userId,
        kind,
        title,
        body,
        source,
        createdByUserId,
        pollId,
      })),
    });

    // Push is best effort and never blocks the batch — same tag for everyone,
    // so a re-send collapses in the tray instead of stacking.
    await Promise.all(
      userIds.map((userId) => this.push.sendToUser(userId, { title, body, tag: pollId })),
    );

    return userIds.length;
  }

  /**
   * Clears a person's outstanding pontaj reminders — they just logged time, so
   * the nudge has done its job and shouldn't need an extra tap to close.
   *
   * Keyed on the person, not the acting user, so an admin logging on someone's
   * behalf clears that person's banner too. Logging for an earlier day clears
   * today's reminder as well; an admin can always send another one.
   */
  async dismissTimesheetRemindersForPerson(personId: string): Promise<void> {
    await this.prisma.notification.updateMany({
      where: {
        kind: 'TIMESHEET_REMINDER',
        dismissedAt: null,
        user: { personId },
      },
      data: { dismissedAt: new Date() },
    });
  }

  /** Hides the notification for good. Idempotent — dismissing twice is fine. */
  async dismiss(userId: string, notificationId: string): Promise<void> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
      select: { id: true, dismissedAt: true },
    });
    if (!notification) {
      throw new NotFoundException('Notification not found');
    }
    if (notification.dismissedAt) {
      return;
    }

    await this.prisma.notification.update({
      where: { id: notification.id },
      data: { dismissedAt: new Date() },
    });
  }

  /**
   * Registers a device for push. Re-subscribing with the same endpoint moves it
   * to the current user — browsers reuse the endpoint when accounts switch on a
   * shared phone.
   */
  async savePushSubscription(
    userId: string,
    subscription: PushSubscriptionInput,
    userAgent?: string,
  ): Promise<void> {
    const data = {
      userId,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: userAgent?.slice(0, 255),
      lastUsedAt: new Date(),
    };

    await this.prisma.pushSubscription.upsert({
      where: { endpoint: subscription.endpoint },
      create: { endpoint: subscription.endpoint, ...data },
      update: data,
    });
  }

  async removePushSubscription(userId: string, endpoint: string): Promise<void> {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
  }
}
