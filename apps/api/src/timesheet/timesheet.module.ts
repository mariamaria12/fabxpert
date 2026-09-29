import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TimesheetController } from './timesheet.controller';
import { TimesheetEventsService } from './timesheet-events.service';
import { TimesheetService } from './timesheet.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificationModule],
  controllers: [TimesheetController],
  providers: [TimesheetService, TimesheetEventsService],
})
export class TimesheetModule {}
