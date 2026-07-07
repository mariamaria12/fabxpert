import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { EmployeeRoleController } from './employee-role.controller';
import { EmployeeRoleService } from './employee-role.service';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeeRoleController],
  providers: [EmployeeRoleService],
})
export class EmployeeRoleModule {}
