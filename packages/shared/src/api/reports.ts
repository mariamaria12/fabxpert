import { request } from './client';
import type { ProductivityReportResponse } from '../dto/report.dto';
import { reportPeriodToQuery, type ReportPeriod } from '../reportPeriod';

/** Productivity analytics for FINALIZAT projects completed inside the interval. */
export function getProductivityReport(period: ReportPeriod) {
  const searchParams = new URLSearchParams();
  const query = reportPeriodToQuery(period);
  searchParams.set('period', query.period);
  if (query.from?.trim()) {
    searchParams.set('from', query.from.trim());
  }
  if (query.to?.trim()) {
    searchParams.set('to', query.to.trim());
  }
  return request<ProductivityReportResponse>(
    `/reports/productivity?${searchParams.toString()}`,
  );
}
