import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
