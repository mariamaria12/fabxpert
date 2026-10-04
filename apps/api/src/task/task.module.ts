import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { TaskController } from './task.controller';
import { TaskEventsService } from './task-events.service';
import { TaskService } from './task.service';

@Module({
  imports: [AuthModule, PrismaModule, NotificationModule],
  controllers: [TaskController],
  providers: [TaskService, TaskEventsService],
})
export class TaskModule {}
