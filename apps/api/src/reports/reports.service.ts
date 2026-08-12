import { Injectable } from '@nestjs/common';
import type { ProductivityReportResponse } from '@fabxpert/shared/dto/report.dto';
import { PrismaService } from '../prisma/prisma.service';
import { isPastInterval, type ResolvedReportPeriod } from './report-period.util';
import {
  buildActivityAggregateQuery,
  buildProjectAggregateQuery,
  shapeProductivityReport,
  type ActivityAggregateRow,
  type ProjectAggregateRow,
} from './reports-productivity.util';

type CacheEntry = { expiresAt: number; value: ProductivityReportResponse };

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  // Fully-past intervals never change (the spec sanctions caching them), so we
  // memoize them briefly; the current month and anything touching today skip the
  // cache and always recompute. TTL bounds staleness from retroactive edits.
  private readonly cache = new Map<string, CacheEntry>();
  private static readonly CACHE_TTL_MS = 15 * 60 * 1000;
  private static readonly CACHE_MAX_ENTRIES = 64;

  async getProductivityReport(
    resolved: ResolvedReportPeriod,
  ): Promise<ProductivityReportResponse> {
    const cacheable = isPastInterval(resolved);
    const cacheKey = `${resolved.fromDay}|${resolved.toDay}`;

    if (cacheable) {
      const hit = this.cache.get(cacheKey);
      if (hit && hit.expiresAt > Date.now()) {
        return hit.value;
      }
    }

    const [projectRows, activityRows] = await Promise.all([
      this.prisma.$queryRaw<ProjectAggregateRow[]>(
        buildProjectAggregateQuery(resolved.from, resolved.toExclusive),
      ),
      this.prisma.$queryRaw<ActivityAggregateRow[]>(
        buildActivityAggregateQuery(resolved.from, resolved.toExclusive),
      ),
    ]);

    const response = shapeProductivityReport(
      resolved.period,
      resolved.fromDay,
      resolved.toDay,
      projectRows,
      activityRows,
    );

    if (cacheable) {
      this.storeInCache(cacheKey, response);
    }
    return response;
  }

  private storeInCache(key: string, value: ProductivityReportResponse): void {
    if (this.cache.size >= ReportsService.CACHE_MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) {
        this.cache.delete(oldest);
      }
    }
    this.cache.set(key, {
      expiresAt: Date.now() + ReportsService.CACHE_TTL_MS,
      value,
    });
  }
}
