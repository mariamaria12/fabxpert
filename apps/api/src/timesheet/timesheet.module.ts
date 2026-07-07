import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TimesheetController } from './timesheet.controller';
import { TimesheetService } from './timesheet.service';

@Module({
  imports: [PrismaModule],
  controllers: [TimesheetController],
  providers: [TimesheetService],
})
export class TimesheetModule {}
