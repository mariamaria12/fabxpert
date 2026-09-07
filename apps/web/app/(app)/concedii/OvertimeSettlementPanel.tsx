'use client';

import {
  formatOvertimeBalance,
  formatOvertimeHours,
  previewOvertimeSettlement,
  settleOvertimeMonth,
  type OvertimeSettlementPreviewResponse,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { PersonName } from '@/components/PersonAvatar';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

interface OvertimeSettlementPanelProps {
  open: boolean;
  onClose: () => void;
  /** Called after a month is settled, so the balances behind reload. */
  onSettled: () => void;
}

/** The last month that is over — the one an admin normally settles. */
function lastCompleteMonth(reference = new Date()): string {
  const previous = new Date(reference.getFullYear(), reference.getMonth() - 1, 1);
  return `${previous.getFullYear()}-${String(previous.getMonth() + 1).padStart(2, '0')}`;
}

/** Hours typed into a reserve field, as minutes. Blank and junk both mean none. */
function reserveToMinutes(value: string): number {
  const hours = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }
  return Math.round(hours * 60);
}

export function OvertimeSettlementPanel({
  open,
  onClose,
  onSettled,
}: OvertimeSettlementPanelProps) {
  const { showToast } = useToast();
  const [month, setMonth] = useState(lastCompleteMonth);
  const [preview, setPreview] = useState<OvertimeSettlementPreviewResponse | null>(null);
  const [reserves, setReserves] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPreview = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);

    try {
      setPreview(await previewOvertimeSettlement(target));
    } catch (caught) {
      setPreview(null);
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    setReserves({});
    void loadPreview(month);
  }, [open, month, loadPreview]);

  async function handleSettle() {
    setSubmitting(true);
    setError(null);

    try {
      const reserveMinutesByPerson: Record<string, number> = {};
      for (const [personId, value] of Object.entries(reserves)) {
        const minutes = reserveToMinutes(value);
        if (minutes > 0) {
          reserveMinutesByPerson[personId] = minutes;
        }
      }

      const result = await settleOvertimeMonth(month, reserveMinutesByPerson);
      showToast(
        `${result.month} decontată: ${formatOvertimeHours(result.totalPaidMinutes)} de plată pentru ${result.personsSettled} persoane.`,
        'success',
      );
      onSettled();
      onClose();
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setSubmitting(false);
    }
  }

  // Totals follow the reserves as they are typed, so the payout figure in the
  // footer is always the one the button is about to commit.
  const lines = preview?.lines ?? [];
  const totals = lines.reduce(
    (sum, line) => {
      if (line.balanceMinutes <= 0) {
        return { paid: sum.paid, carried: sum.carried + line.balanceMinutes };
      }
      const reserve = Math.min(
        reserveToMinutes(reserves[line.person.id] ?? ''),
        line.balanceMinutes,
      );
      return {
        paid: sum.paid + line.balanceMinutes - reserve,
        carried: sum.carried + reserve,
      };
    },
    { paid: 0, carried: 0 },
  );

  const footer = (
    <div className="flex gap-2">
      <button
        type="button"
        disabled={submitting || loading || lines.length === 0}
        onClick={() => void handleSettle()}
        className="flex-1 rounded-md bg-accent px-4 py-2.5 text-sm font-medium text-accent-contrast disabled:cursor-not-allowed disabled:opacity-60"
      >
        {submitting ? 'Se decontează…' : `Decontează ${formatOvertimeHours(totals.paid)}`}
      </button>
      <button
        type="button"
        disabled={submitting}
        onClick={onClose}
        className="rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:cursor-not-allowed disabled:opacity-50"
      >
        Anulează
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title="Decontare ore suplimentare"
      onClose={onClose}
      disableClose={submitting}
      footer={footer}
      widthClassName="max-w-3xl"
    >
      <div className="flex flex-col gap-4">
        <div>
          <label htmlFor="settlement-month" className="text-xs text-text-secondary">
            Luna
          </label>
          <input
            id="settlement-month"
            type="month"
            value={month}
            max={lastCompleteMonth()}
            onChange={(event) => setMonth(event.target.value)}
            disabled={submitting}
            className="mt-1.5 w-48 rounded-md border border-border bg-surface px-3 py-2 text-sm text-text-primary"
          />
        </div>

        {error ? (
          <p className="rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3 text-sm text-danger">
            {error}
          </p>
        ) : null}

        {preview?.alreadySettled ? (
          <p className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3 text-sm text-text-secondary">
            Luna a mai fost decontată. Dacă o decontezi din nou, valorile se rescriu, iar
            diferența se reportează în lunile următoare.
          </p>
        ) : null}

        {loading ? (
          <p className="text-sm text-text-secondary">Se încarcă previzualizarea…</p>
        ) : lines.length === 0 && !error ? (
          <p className="text-sm text-text-secondary">
            Nimic de decontat în această lună.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-xs text-text-secondary">
                <th className="py-2 text-left font-normal">Angajat</th>
                <th className="py-2 text-right font-normal">Report</th>
                <th className="py-2 text-right font-normal">Luna</th>
                <th className="py-2 text-right font-normal">Sold</th>
                <th className="py-2 text-right font-normal">Rezervă (h)</th>
                <th className="py-2 text-right font-normal">De plată</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((line) => {
                const isDebt = line.balanceMinutes <= 0;
                const reserve = Math.min(
                  reserveToMinutes(reserves[line.person.id] ?? ''),
                  Math.max(line.balanceMinutes, 0),
                );

                return (
                  <tr key={line.person.id} className="border-b border-border-subtle">
                    <td className="py-2">
                      <PersonName person={line.person} />
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">
                      {line.carriedInMinutes === 0
                        ? '—'
                        : formatOvertimeBalance(line.carriedInMinutes)}
                    </td>
                    <td className="py-2 text-right tabular-nums text-text-secondary">
                      {formatOvertimeHours(line.earnedMinutes)}
                    </td>
                    <td
                      className={`py-2 text-right tabular-nums ${
                        isDebt ? 'text-danger' : 'text-text-primary'
                      }`}
                    >
                      {formatOvertimeBalance(line.balanceMinutes)}
                    </td>
                    <td className="py-2 text-right">
                      {isDebt ? (
                        <span className="text-text-muted">—</span>
                      ) : (
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          value={reserves[line.person.id] ?? ''}
                          placeholder="0"
                          disabled={submitting}
                          onChange={(event) =>
                            setReserves((current) => ({
                              ...current,
                              [line.person.id]: event.target.value,
                            }))
                          }
                          className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm text-text-primary"
                        />
                      )}
                    </td>
                    <td className="py-2 text-right tabular-nums font-medium">
                      {isDebt
                        ? '—'
                        : formatOvertimeHours(line.balanceMinutes - reserve)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {lines.length > 0 ? (
          <p className="text-xs text-text-muted">
            Se plătește tot soldul, mai puțin rezerva pe care o lași fiecăruia. Datoriile
            nu se plătesc — se reportează întregi în luna următoare
            {totals.carried < 0
              ? `, în total ${formatOvertimeBalance(totals.carried)}`
              : ''}
            .
          </p>
        ) : null}
      </div>
    </SlideOverPanel>
  );
}
