'use client';

import {
  formatOvertimeBalance,
  formatOvertimeHours,
  previewOvertimeSettlement,
  settleOvertimeMonth,
  type OvertimeSettlementLineDto,
  type OvertimeSettlementPreviewResponse,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { filterChipClassName } from '@/components/filterChipStyles';
import { PersonName } from '@/components/PersonAvatar';
import { useOvertimePendingCount } from '@/context/OvertimePendingCountContext';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { MonthPicker } from './MonthPicker';
import { StatTile, StatTileRow } from './StatTile';
import { formatRomanianDate } from './timesheetFormat';
import { currentMonth, formatMonthLabel, latestSettleableMonth } from './timesheetMonths';
import { approvalBadge, STATUS_BADGE_CLASS } from './timesheetStatus';

interface OvertimeApprovalsTabProps {
  active: boolean;
  /** Step 4 of the flow — where the approved hours end up. */
  onOpenAccounting: () => void;
}

type StatusFilter = 'pending' | 'approved' | 'all';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'pending', label: 'În așteptare' },
  { id: 'approved', label: 'Aprobate' },
  { id: 'all', label: 'Toate' },
];

/** Hours typed into a reserve field, as minutes. Blank and junk both mean none. */
function reserveToMinutes(value: string): number {
  const hours = Number.parseFloat(value.replace(',', '.'));
  if (!Number.isFinite(hours) || hours <= 0) {
    return 0;
  }
  return Math.round(hours * 60);
}

function reserveToInput(minutes: number): string {
  return minutes > 0 ? String(Math.round((minutes / 60) * 100) / 100) : '';
}

/** What a line pays with the reserve as currently typed. */
function paidWithReserve(line: OvertimeSettlementLineDto, reserveInput: string): number {
  if (line.balanceMinutes <= 0) {
    return 0;
  }
  return line.balanceMinutes - Math.min(reserveToMinutes(reserveInput), line.balanceMinutes);
}

/**
 * Step 3 of the flow: in the last week of the month, approve what each person
 * is paid for the overtime they hold. Approving writes the settlement; a
 * reserve is what the person keeps as time off instead of pay, and a debt is
 * carried, never paid.
 */
export function OvertimeApprovalsTab({ active, onOpenAccounting }: OvertimeApprovalsTabProps) {
  const { showToast } = useToast();
  const { refreshPendingCount } = useOvertimePendingCount();
  const [month, setMonth] = useState(latestSettleableMonth);
  const [preview, setPreview] = useState<OvertimeSettlementPreviewResponse | null>(null);
  const [reserves, setReserves] = useState<Record<string, string>>({});
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('pending');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  /** Person being approved, or 'all' for the whole month. */
  const [busy, setBusy] = useState<string | null>(null);

  const loadPreview = useCallback(async (target: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await previewOvertimeSettlement(target);
      setPreview(response);
      // An approved line shows the reserve it was approved with.
      setReserves(
        Object.fromEntries(
          response.lines
            .filter((line) => line.settledAt !== null && line.reserveMinutes > 0)
            .map((line) => [line.person.id, reserveToInput(line.reserveMinutes)]),
        ),
      );
    } catch (caught) {
      setPreview(null);
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPreview(month);
  }, [month, loadPreview]);

  // Back on the step after pontaje were corrected: the balances moved.
  useEffect(() => {
    if (active && !loading) {
      void loadPreview(month);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function approve(
    lines: OvertimeSettlementLineDto[],
    key: string,
    reserveOverride?: number,
  ) {
    if (lines.length === 0) {
      return;
    }
    setBusy(key);

    try {
      const reserveMinutesByPerson: Record<string, number> = {};
      for (const line of lines) {
        const minutes = reserveOverride ?? reserveToMinutes(reserves[line.person.id] ?? '');
        // Zero is sent too, so a reserve cleared in the field is really cleared.
        reserveMinutesByPerson[line.person.id] = minutes;
      }

      const result = await settleOvertimeMonth(
        month,
        reserveMinutesByPerson,
        lines.map((line) => line.person.id),
      );
      showToast(
        lines.length === 1
          ? `${formatMonthLabel(month)} aprobată pentru ${lines[0].person.firstName} ${lines[0].person.lastName}: ${formatOvertimeHours(result.totalPaidMinutes)} de plată.`
          : `${formatMonthLabel(month)} aprobată: ${formatOvertimeHours(result.totalPaidMinutes)} de plată pentru ${result.personsSettled} persoane.`,
        'success',
      );
      await Promise.all([loadPreview(month), refreshPendingCount()]);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setBusy(null);
    }
  }

  const lines = preview?.lines ?? [];
  const pending = lines.filter((line) => line.settledAt === null);
  const approved = lines.filter((line) => line.settledAt !== null);
  const pendingPaid = pending.reduce(
    (sum, line) => sum + paidWithReserve(line, reserves[line.person.id] ?? ''),
    0,
  );
  const pendingCarried = pending.reduce(
    (sum, line) =>
      sum +
      (line.balanceMinutes <= 0
        ? line.balanceMinutes
        : line.balanceMinutes - paidWithReserve(line, reserves[line.person.id] ?? '')),
    0,
  );
  const approvedPaid = approved.reduce((sum, line) => sum + line.paidMinutes, 0);

  const visibleLines =
    statusFilter === 'pending' ? pending : statusFilter === 'approved' ? approved : lines;

  const emptyMessage =
    statusFilter === 'pending'
      ? 'Nimic de aprobat — toată luna e aprobată.'
      : statusFilter === 'approved'
        ? 'Nicio persoană aprobată încă.'
        : 'Nimic de aprobat în această lună.';

  const columns: DataTableColumn<OvertimeSettlementLineDto>[] = [
    {
      key: 'person',
      header: 'Angajat',
      width: '220px',
      render: (line) => <PersonName person={line.person} nameClassName="font-medium" />,
    },
    {
      key: 'role',
      header: 'Rol',
      width: '130px',
      className: 'text-text-secondary',
      render: (line) => line.person.employeeRole?.name ?? '—',
    },
    {
      key: 'carriedIn',
      header: 'Report',
      width: '96px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (line) =>
        line.carriedInMinutes === 0 ? '—' : formatOvertimeBalance(line.carriedInMinutes),
    },
    {
      key: 'earned',
      header: 'Luna',
      width: '96px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (line) => formatOvertimeBalance(line.earnedMinutes),
    },
    {
      key: 'used',
      header: 'Folosite',
      width: '96px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (line) => (line.usedMinutes === 0 ? '—' : formatOvertimeHours(line.usedMinutes)),
    },
    {
      key: 'saturdays',
      header: 'Sâmbete',
      width: '90px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (line) => (line.saturdaysWorked === 0 ? '—' : line.saturdaysWorked),
    },
    {
      key: 'balance',
      header: 'Sold',
      width: '100px',
      className: 'text-right tabular-nums',
      render: (line) => (
        <span
          className={`font-medium ${line.balanceMinutes < 0 ? 'text-danger' : 'text-text-primary'}`}
        >
          {formatOvertimeBalance(line.balanceMinutes)}
        </span>
      ),
    },
    {
      key: 'reserve',
      header: 'Păstrate (h)',
      width: '110px',
      className: 'text-right',
      render: (line) =>
        line.balanceMinutes <= 0 ? (
          <span className="text-text-muted">—</span>
        ) : (
          <input
            type="number"
            min={0}
            step={0.5}
            value={reserves[line.person.id] ?? ''}
            placeholder="0"
            disabled={busy !== null}
            aria-label={`Ore păstrate pentru ${line.person.firstName} ${line.person.lastName}`}
            onChange={(event) =>
              setReserves((current) => ({ ...current, [line.person.id]: event.target.value }))
            }
            className="w-20 rounded-md border border-border bg-surface px-2 py-1 text-right text-sm tabular-nums text-text-primary focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
        ),
    },
    {
      key: 'paid',
      header: 'De plată',
      width: '100px',
      className: 'text-right tabular-nums',
      render: (line) => {
        const paid = paidWithReserve(line, reserves[line.person.id] ?? '');
        return (
          <span className={paid > 0 ? 'font-semibold text-warning-text' : 'text-text-muted'}>
            {paid > 0 ? formatOvertimeHours(paid) : '—'}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      width: '150px',
      render: (line) => {
        const badge = approvalBadge(line.settledAt);
        return (
          <div>
            <span className={`${STATUS_BADGE_CLASS} ${badge.className}`}>{badge.label}</span>
            {line.settledAt ? (
              <div className="mt-1 text-[11px] text-text-muted">
                {formatRomanianDate(line.settledAt)}
              </div>
            ) : null}
          </div>
        );
      },
    },
    {
      key: 'actions',
      header: '',
      width: '210px',
      className: 'overflow-visible',
      render: (line) => {
        const isBusy = busy === line.person.id || busy === 'all';
        const approvedAlready = line.settledAt !== null;

        return (
          <div className="flex items-center justify-end gap-1.5">
            {line.balanceMinutes > 0 ? (
              <button
                type="button"
                disabled={busy !== null}
                title="Nu se plătește nimic — tot soldul rămâne ca ore de recuperat"
                onClick={() => void approve([line], line.person.id, line.balanceMinutes)}
                className="rounded-md border border-border px-2.5 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
              >
                Reportează tot
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy !== null}
              onClick={() => void approve([line], line.person.id)}
              className={`inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-50 ${
                approvedAlready
                  ? 'border-border text-text-secondary hover:bg-surface-raised hover:text-text-primary'
                  : 'border-success-border bg-success-bg text-success-text hover:opacity-90'
              }`}
            >
              <i
                className={`ti ${isBusy ? 'ti-loader-2 animate-spin' : 'ti-check'} text-sm`}
                aria-hidden="true"
              />
              {approvedAlready ? 'Reaprobă' : 'Aprobă'}
            </button>
          </div>
        );
      },
    },
  ];

  return (
    <div className="flex flex-col">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-text-primary">Aprobări ore suplimentare</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            În ultima săptămână a lunii aprobi ce rămâne de plată. Doar ce aprobi aici intră în
            pontajul pentru contabilitate.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onOpenAccounting}
            className="inline-flex items-center gap-2 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary sm:px-4 sm:py-2 sm:text-sm"
          >
            Contabilitate
            <i className="ti ti-chevron-right text-base" aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={busy !== null || loading || pending.length === 0}
            onClick={() => void approve(pending, 'all')}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60 sm:px-4 sm:py-2 sm:text-sm"
          >
            <i
              className={`ti ${busy === 'all' ? 'ti-loader-2 animate-spin' : 'ti-checks'} text-base`}
              aria-hidden="true"
            />
            {pending.length > 0 ? `Aprobă toate (${pending.length})` : 'Aprobă toate'}
          </button>
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <MonthPicker
          value={month}
          onChange={setMonth}
          max={latestSettleableMonth()}
          disabled={busy !== null}
        />
        <div className="flex flex-wrap items-center gap-1.5">
          {STATUS_FILTERS.map((filter) => (
            <button
              key={filter.id}
              type="button"
              onClick={() => setStatusFilter(filter.id)}
              className={filterChipClassName(statusFilter === filter.id)}
            >
              {filter.label}
              {filter.id === 'pending' && pending.length > 0 ? (
                <span className="tabular-nums opacity-80">{pending.length}</span>
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {month === currentMonth() ? (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-info-border bg-info-bg px-4 py-3 text-sm text-info-text">
          <i className="ti ti-info-circle mt-0.5 shrink-0 text-base" aria-hidden="true" />
          <div>
            <span className="font-semibold">Luna e încă în curs.</span> Poți aproba de pe acum, cu
            orele pontate până azi. Orele din zilele rămase intră doar dacă reaprobi după ultima zi
            a lunii.
          </div>
        </div>
      ) : null}

      <div className="mt-4">
        <StatTileRow>
          <StatTile
            label="În așteptare"
            icon="ti-hourglass"
            warning={pending.length > 0}
            value={loading ? '—' : pending.length}
            hint={pending.length === 0 ? 'toată luna e aprobată' : 'persoane de aprobat'}
          />
          <StatTile
            label="De plată la aprobare"
            icon="ti-cash"
            accent
            value={loading ? '—' : formatOvertimeHours(pendingPaid)}
            hint="cu orele păstrate scăzute"
          />
          <StatTile
            label="Se reportează"
            icon="ti-arrow-forward"
            value={loading ? '—' : formatOvertimeBalance(pendingCarried)}
            hint="ore păstrate și datorii"
          />
          <StatTile
            label="Aprobate deja"
            icon="ti-checks"
            value={loading ? '—' : formatOvertimeHours(approvedPaid)}
            hint={approved.length === 1 ? '1 persoană' : `${approved.length} persoane`}
          />
        </StatTileRow>
      </div>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadPreview(month)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <DataTable
          storageKey="overtime-approvals-list"
          columns={columns}
          data={visibleLines}
          rowKey={(line) => line.person.id}
          loading={loading}
          emptyMessage={emptyMessage}
        />
      </div>

      {!loading && !error && lines.length > 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          Se plătește tot soldul, mai puțin orele pe care le lași fiecăruia de recuperat. Datoriile
          nu se plătesc — se reportează întregi în luna următoare. O lună aprobată se poate
          reaproba: valorile se rescriu, iar diferența se reportează.
        </p>
      ) : null}
    </div>
  );
}
