import { Controller, Get, Query } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ReportsService } from './reports.service';
import { parseReportPeriodQuery } from './report-period.util';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) {}

  @Get('productivity')
  @Roles('ADMIN')
  productivity(@Query() query: Record<string, string>) {
    const resolved = parseReportPeriodQuery(query);
    return this.reportsService.getProductivityReport(resolved);
  }
}
