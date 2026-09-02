import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { ActivityModule } from './activity/activity.module';
import { AssemblyModule } from './assembly/assembly.module';
import { AuthModule } from './auth/auth.module';
import { AuthGuard } from './auth/guards/auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { CompanyModule } from './company/company.module';
import { EmployeeRoleModule } from './employee-role/employee-role.module';
import { PersonModule } from './person/person.module';
import { ProjectModule } from './project/project.module';
import { ReportsModule } from './reports/reports.module';
import { TimesheetModule } from './timesheet/timesheet.module';
import { LeaveModule } from './leave/leave.module';
import { OvertimeModule } from './overtime/overtime.module';
import { NotificationModule } from './notification/notification.module';
import { PollModule } from './poll/poll.module';
import { UserModule } from './user/user.module';
import { PrismaModule } from './prisma/prisma.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    CompanyModule,
    ActivityModule,
    AssemblyModule,
    EmployeeRoleModule,
    PersonModule,
    ProjectModule,
    UserModule,
    TimesheetModule,
    ReportsModule,
    LeaveModule,
    OvertimeModule,
    NotificationModule,
    PollModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
