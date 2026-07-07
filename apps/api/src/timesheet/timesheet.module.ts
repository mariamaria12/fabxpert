import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TimesheetController } from './timesheet.controller';
import { TimesheetEventsService } from './timesheet-events.service';
import { TimesheetService } from './timesheet.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimesheetController],
  providers: [TimesheetService, TimesheetEventsService],
})
export class TimesheetModule {}
