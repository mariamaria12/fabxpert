import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { NotificationController } from './notification.controller';
import { NotificationService } from './notification.service';
import { PushService } from './push.service';
import { TimesheetReminderService } from './timesheet-reminder.service';

@Module({
  imports: [PrismaModule],
  controllers: [NotificationController],
  providers: [NotificationService, PushService, TimesheetReminderService],
  exports: [NotificationService],
})
export class NotificationModule {}
