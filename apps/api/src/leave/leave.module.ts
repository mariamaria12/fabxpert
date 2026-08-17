import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { OvertimeModule } from '../overtime/overtime.module';
import { LeaveController } from './leave.controller';
import { LeaveService } from './leave.service';

@Module({
  imports: [PrismaModule, OvertimeModule],
  controllers: [LeaveController],
  providers: [LeaveService],
})
export class LeaveModule {}
