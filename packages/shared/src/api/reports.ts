import { request } from './client';
import type {
  ActiveProjectsReportResponse,
  ActivityNormsResponse,
  ProductivityReportResponse,
  ProjectReportResponse,
} from '../dto/report.dto';
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

/** Fișa proiectului: the whole life of one project, by activity and by person. */
export function getProjectReport(projectId: string) {
  return request<ProjectReportResponse>(
    `/reports/projects/${encodeURIComponent(projectId)}`,
  );
}

/** Hours burned against pieces finished, over the projects still in the shop. */
export function getActiveProjectsReport() {
  return request<ActiveProjectsReportResponse>('/reports/active-projects');
}

/** Hours per ton by activity, over the last `months` months of deliveries. */
export function getActivityNorms(months: number) {
  return request<ActivityNormsResponse>(`/reports/norms?months=${months}`);
}
