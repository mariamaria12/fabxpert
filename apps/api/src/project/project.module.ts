import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { PrismaModule } from '../prisma/prisma.module';
import { ProjectAvailabilityEventsService } from './project-availability-events.service';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';

@Module({
  imports: [AuthModule, PrismaModule],
  controllers: [ProjectController],
  providers: [ProjectService, ProjectAvailabilityEventsService],
  exports: [ProjectAvailabilityEventsService],
})
export class ProjectModule {}
