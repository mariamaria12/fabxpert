'use client';

import { getActivityNorms, type ActivityNormsResponse } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { filterChipClassName } from '@/components/filterChipStyles';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { EmptyHint, SectionCard } from './ReportSection';
import { paletteColor } from './reportColors';
import { formatHours, formatHoursPerTon, formatRangeLabel } from './reportsFormat';

const MONTH_OPTIONS = [6, 12, 24] as const;
const DEFAULT_MONTHS = 12;
const DEFAULT_TONS = '10';

const tonsFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 1 });
const hoursFormat = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border-subtle bg-surface px-3 py-2">
      <div className="truncate text-[11px] leading-tight text-text-muted">{label}</div>
      <div className="mt-0.5 flex items-baseline gap-1.5">
        <span className="text-2xl font-semibold tabular-nums leading-none text-text-primary">
          {value}
        </span>
        {sub && <span className="text-[10px] text-text-muted">{sub}</span>}
      </div>
    </div>
  );
}

/** The tonnage the norms are projected onto; empty until it parses as a number. */
function parseTons(value: string): number | null {
  const parsed = Number.parseFloat(value.replace(',', '.'));
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function NormsTable({
  report,
  tons,
}: {
  report: ActivityNormsResponse;
  tons: number | null;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border-subtle text-left text-[11px] uppercase tracking-wide text-text-muted">
            <th className="py-1.5 pr-2 font-medium">Activitate</th>
            <th className="py-1.5 pr-2 text-right font-medium">Proiecte</th>
            <th className="py-1.5 pr-2 text-right font-medium">Ore</th>
            <th className="py-1.5 pr-2 text-right font-medium">Normativ</th>
            <th className="py-1.5 pr-2 text-right font-medium">Median</th>
            <th className="py-1.5 pr-2 text-right font-medium">Interval</th>
            {tons !== null && (
              <th className="py-1.5 text-right font-medium">
                Pentru {tonsFormat.format(tons)} t
              </th>
            )}
          </tr>
        </thead>
        <tbody>
          {report.activities.map((row, index) => (
            <tr
              key={row.activityId ?? 'none'}
              className="border-b border-border-subtle/60 last:border-0"
            >
              <td className="py-1.5 pr-2">
                <span className="flex items-center gap-1.5">
                  <span
                    className="size-2 shrink-0 rounded-full"
                    style={{ backgroundColor: row.color ?? paletteColor(index) }}
                    aria-hidden="true"
                  />
                  <span className="truncate text-text-primary">{row.activityName}</span>
                </span>
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-text-muted">
                {row.projectCount}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                {formatHours(row.workedMinutes)}
              </td>
              <td className="py-1.5 pr-2 text-right font-medium tabular-nums text-text-primary">
                {formatHoursPerTon(row.pooledHoursPerTon)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                {formatHoursPerTon(row.medianHoursPerTon)}
              </td>
              <td className="py-1.5 pr-2 text-right text-[11px] tabular-nums text-text-muted">
                {formatHoursPerTon(row.p25HoursPerTon)} – {formatHoursPerTon(row.p75HoursPerTon)}
              </td>
              {tons !== null && (
                <td className="py-1.5 text-right font-medium tabular-nums text-text-primary">
                  {hoursFormat.format(row.pooledHoursPerTon * tons)}h
                </td>
              )}
            </tr>
          ))}
        </tbody>
        {report.pooledHoursPerTon !== null && (
          <tfoot>
            <tr className="border-t border-border text-text-primary">
              <td className="py-1.5 pr-2 font-medium">Total</td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-text-muted">
                {report.projectCount}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums">
                {formatHours(report.totalWorkedMinutes)}
              </td>
              <td className="py-1.5 pr-2 text-right font-semibold tabular-nums">
                {formatHoursPerTon(report.pooledHoursPerTon)}
              </td>
              <td className="py-1.5 pr-2 text-right tabular-nums text-text-secondary">
                {formatHoursPerTon(report.medianHoursPerTon)}
              </td>
              <td className="py-1.5 pr-2" />
              {tons !== null && (
                <td className="py-1.5 text-right font-semibold tabular-nums">
                  {hoursFormat.format(report.pooledHoursPerTon * tons)}h
                </td>
              )}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

export function ActivityNormsView() {
  const [months, setMonths] = useState<number>(DEFAULT_MONTHS);
  const [tonsInput, setTonsInput] = useState(DEFAULT_TONS);
  const [report, setReport] = useState<ActivityNormsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadReport = useCallback(async (selectedMonths: number) => {
    setLoading(true);
    setError(null);
    try {
      setReport(await getActivityNorms(selectedMonths));
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadReport(months);
  }, [loadReport, months]);

  const tons = parseTons(tonsInput);

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {MONTH_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            aria-pressed={months === option}
            onClick={() => setMonths(option)}
            className={filterChipClassName(months === option)}
          >
            Ultimele {option} luni
          </button>
        ))}
      </div>

      {loading && <p className="py-8 text-center text-sm text-text-muted">Se încarcă…</p>}

      {!loading && error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadReport(months)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {!loading && !error && report && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Kpi
              label="Normativ general"
              value={formatHoursPerTon(report.pooledHoursPerTon)}
              sub="ore pe tonă"
            />
            <Kpi label="Proiecte în bază" value={String(report.projectCount)} />
            <Kpi label="Tone livrate" value={`${tonsFormat.format(report.totalTons)} t`} />
            <Kpi label="Ore lucrate" value={formatHours(report.totalWorkedMinutes)} />
          </div>

          <SectionCard
            title="Normative pe activitate"
            hint={formatRangeLabel(report.from, report.to)}
          >
            {report.activities.length === 0 ? (
              <EmptyHint>
                Niciun proiect livrat cu greutate și ore pontate în intervalul ales.
              </EmptyHint>
            ) : (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label
                    htmlFor="norms-tons"
                    className="text-[11px] text-text-secondary"
                  >
                    Estimare pentru
                  </label>
                  <input
                    id="norms-tons"
                    type="text"
                    inputMode="decimal"
                    value={tonsInput}
                    onChange={(event) => setTonsInput(event.target.value)}
                    className="w-20 rounded-md border border-border bg-surface-raised px-2 py-1 text-sm tabular-nums text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
                  />
                  <span className="text-[11px] text-text-secondary">tone</span>
                </div>

                <NormsTable report={report} tons={tons} />

                <p className="mt-2 text-[11px] leading-relaxed text-text-muted">
                  Normativul e totalul orelor împărțit la totalul tonelor pe care s-a
                  lucrat pasul respectiv. Medianul și intervalul arată cât de mult
                  variază de la un proiect la altul — un interval larg înseamnă că
                  normativul nu ține loc de estimare pe proiectul concret.
                  {report.skippedWithoutWeight > 0 && (
                    <>
                      {' '}
                      {report.skippedWithoutWeight}{' '}
                      {report.skippedWithoutWeight === 1
                        ? 'proiect livrat nu are greutate și a rămas pe dinafară'
                        : 'proiecte livrate nu au greutate și au rămas pe dinafară'}
                      .
                    </>
                  )}
                </p>
              </>
            )}
          </SectionCard>
        </>
      )}
    </div>
  );
}
