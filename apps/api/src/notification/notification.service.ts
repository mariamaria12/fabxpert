import { Injectable, NotFoundException } from '@nestjs/common';
import type { NotificationKind, NotificationSource, Prisma } from '@prisma/client';
import type {
  NotificationDto,
  PushSubscriptionInput,
} from '@fabxpert/shared/dto/notification.dto';
import { PrismaService } from '../prisma/prisma.service';
import { PushService } from './push.service';

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
};

function toDto(notification: NotificationWithAuthor): NotificationDto {
  const person = notification.createdBy?.person;
  return {
    id: notification.id,
    kind: notification.kind,
    source: notification.source,
    title: notification.title,
    body: notification.body,
    createdAt: notification.createdAt.toISOString(),
    createdByName: person ? `${person.firstName} ${person.lastName}` : null,
  };
}

@Injectable()
export class NotificationService {
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
    const { userId, kind, title, body, source = 'SYSTEM', createdByUserId } = params;

    const created = await this.prisma.notification.create({
      data: { userId, kind, title, body, source, createdByUserId },
      include: { createdBy: { include: { person: true } } },
    });

    await this.push.sendToUser(userId, { title, body, tag: created.id });

    return toDto(created);
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
