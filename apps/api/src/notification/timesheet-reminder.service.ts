import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from './notification.service';

const REMINDER_TITLE = 'Nu uita de pontaj';
const REMINDER_BODY = 'Nu ai adăugat încă pontajul de azi. Durează mai puțin de un minut.';

@Injectable()
export class TimesheetReminderService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Sends the pontaj reminder to one person — the only way a reminder goes out.
   * Admins trigger it from the "Nu au pontat azi" panel, one person at a time.
   *
   * Repeat presses send again on purpose: there's no schedule behind this, so
   * the admin decides when a second nudge is warranted. Returns the number of
   * devices the push went to — 0 means the person never allowed notifications,
   * so only the in-app banner appears.
   */
  async sendToPerson(personId: string): Promise<number> {
    const user = await this.prisma.user.findFirst({
      where: { personId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!user) {
      throw new NotFoundException('This person has no active account');
    }

    await this.notificationService.create({
      userId: user.id,
      kind: 'TIMESHEET_REMINDER',
      source: 'SYSTEM',
      title: REMINDER_TITLE,
      body: REMINDER_BODY,
    });

    return this.prisma.pushSubscription.count({ where: { userId: user.id } });
  }
}
