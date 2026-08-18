import { Module } from '@nestjs/common';
import { NotificationModule } from '../notification/notification.module';
import { PrismaModule } from '../prisma/prisma.module';
import { PollController } from './poll.controller';
import { PollService } from './poll.service';

@Module({
  imports: [PrismaModule, NotificationModule],
  controllers: [PollController],
  providers: [PollService],
})
export class PollModule {}
