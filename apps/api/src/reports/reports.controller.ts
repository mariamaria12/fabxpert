import { Controller, Get, Param, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { parseNormsWindow, parseReportPeriodQuery } from './report-period.util';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('productivity')
  @Roles('ADMIN')
  productivity(@Query() query: Record<string, string>) {
    const resolved = parseReportPeriodQuery(query);
    return this.reportsService.getProductivityReport(resolved);
  }

  @Get('active-projects')
  @Roles('ADMIN')
  activeProjects() {
    return this.reportsService.getActiveProjectsReport();
  }

  @Get('norms')
  @Roles('ADMIN')
  norms(@Query('months') months?: string) {
    return this.reportsService.getActivityNorms(parseNormsWindow(months));
  }

  @Get('projects/:projectId')
  @Roles('ADMIN')
  projectReport(@Param('projectId') projectId: string) {
    return this.reportsService.getProjectReport(projectId);
  }
}
