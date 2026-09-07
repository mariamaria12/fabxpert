'use client';

import {
  listOvertimeBalances,
  formatOvertimeBalance,
  formatOvertimeHours,
  type OvertimeBalanceRowDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { StatTile, StatTileRow } from './StatTile';
import { formatMonthLabel, lastCompleteMonth } from './timesheetMonths';

interface OvertimeBalancesTabProps {
  active: boolean;
  /** Step 3 of the flow — where this month's balance gets approved for pay. */
  onOpenApprovals: () => void;
}

/** `settledThroughMonth` is the same for everyone in practice — show it once. */
function settledThroughLabel(rows: OvertimeBalanceRowDto[]): string | null {
  const months = new Set(
    rows
      .map((row) => row.balance.settledThroughMonth)
      .filter((month): month is string => month !== null),
  );

  if (months.size === 0) {
    return 'Nicio lună aprobată încă.';
  }
  if (months.size === 1) {
    return `Aprobat până în ${formatMonthLabel([...months][0])} inclusiv.`;
  }

  return 'Ultima lună aprobată diferă de la o persoană la alta.';
}

function formatUpdatedAt(date: Date): string {
  return date.toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

/** Step 2 of the flow: the running overtime balance of everyone, this month. */
export function OvertimeBalancesTab({ active, onOpenApprovals }: OvertimeBalancesTabProps) {
  const [rows, setRows] = useState<OvertimeBalanceRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await listOvertimeBalances();
      setRows(response.rows);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances]);

  // Coming back to the step after approving a month: the carry-in changed.
  useEffect(() => {
    if (active && !loading) {
      void loadBalances();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function refreshAll() {
    setRefreshing(true);
    try {
      await loadBalances();
      setLastUpdated(new Date());
    } finally {
      setRefreshing(false);
    }
  }

  const columns: DataTableColumn<OvertimeBalanceRowDto>[] = [
    {
      key: 'person',
      header: 'Angajat',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'role',
      header: 'Rol',
      width: '140px',
      className: 'text-text-secondary',
      render: (row) => row.person.employeeRole?.name ?? '—',
    },
    {
      key: 'carriedIn',
      header: 'Report',
      width: '100px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) =>
        row.balance.carriedInMinutes === 0
          ? '—'
          : formatOvertimeBalance(row.balance.carriedInMinutes),
    },
    {
      key: 'earned',
      header: 'Luna aceasta',
      width: '120px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) => formatOvertimeBalance(row.balance.earnedMinutes),
    },
    {
      key: 'used',
      header: 'Folosite',
      width: '100px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) => formatOvertimeHours(row.balance.usedMinutes),
    },
    {
      key: 'saturdays',
      header: 'Sâmbete lucrate',
      width: '120px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) =>
        row.balance.saturdaysWorked === 0 ? '—' : row.balance.saturdaysWorked,
    },
    {
      key: 'remaining',
      header: 'Sold',
      width: '110px',
      className: 'text-right tabular-nums',
      render: (row) => (
        <span
          className={`font-medium ${
            row.balance.remainingMinutes < 0 ? 'text-danger' : 'text-text-primary'
          }`}
        >
          {formatOvertimeBalance(row.balance.remainingMinutes)}
        </span>
      ),
    },
    {
      key: 'days',
      header: 'Zile libere',
      width: '100px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) => row.balance.remainingDays,
    },
  ];

  const positive = rows.filter((row) => row.balance.remainingMinutes > 0);
  const debts = rows.filter((row) => row.balance.remainingMinutes < 0);
  const totalPositive = positive.reduce((sum, row) => sum + row.balance.remainingMinutes, 0);
  const totalDebt = debts.reduce((sum, row) => sum + row.balance.remainingMinutes, 0);
  const totalUsed = rows.reduce((sum, row) => sum + row.balance.usedMinutes, 0);
  const currentMonthLabel = rows[0] ? formatMonthLabel(rows[0].balance.month) : null;

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-[22px] font-medium text-text-primary">Ore suplimentare</h1>
          <p className="mt-0.5 text-sm text-text-muted">
            Soldul fiecăruia peste programul de 9 ore
            {currentMonthLabel ? `, ${currentMonthLabel.toLowerCase()}` : ''}. Se aprobă pentru
            plată la final de lună.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {lastUpdated ? (
            <span className="hidden text-xs text-text-muted sm:inline">
              actualizat {formatUpdatedAt(lastUpdated)}
            </span>
          ) : null}
          <button
            type="button"
            disabled={refreshing || loading}
            onClick={() => void refreshAll()}
            aria-label="Împrospătare date"
            title="Împrospătare date"
            className="inline-flex items-center gap-2 rounded-md border border-border px-2 py-1 text-xs text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50 md:px-3 md:py-2 md:text-sm"
          >
            <i
              className={`ti ti-refresh text-sm md:text-base ${refreshing ? 'animate-spin' : ''}`}
              aria-hidden="true"
            />
            <span className="hidden md:inline">Împrospătare date</span>
          </button>
          <button
            type="button"
            onClick={onOpenApprovals}
            className="inline-flex items-center gap-2 rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-accent-contrast transition-opacity hover:opacity-90 sm:px-4 sm:py-2 sm:text-sm"
          >
            Aprobă {formatMonthLabel(lastCompleteMonth()).toLowerCase()}
            <i className="ti ti-chevron-right text-base" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="mt-5">
        <StatTileRow>
          <StatTile
            label="Cu sold de plată"
            icon="ti-users"
            value={loading ? '—' : positive.length}
            hint={`din ${rows.length} persoane`}
          />
          <StatTile
            label="Sold total"
            icon="ti-flame"
            accent
            value={loading ? '—' : formatOvertimeHours(totalPositive)}
            hint="peste program, neaprobat încă"
          />
          <StatTile
            label="Folosite luna aceasta"
            icon="ti-calendar-off"
            value={loading ? '—' : formatOvertimeHours(totalUsed)}
            hint="recuperări aprobate"
          />
          <StatTile
            label="Datorii"
            icon="ti-arrow-down-right"
            value={loading ? '—' : formatOvertimeBalance(totalDebt)}
            hint={debts.length === 1 ? '1 persoană sub program' : `${debts.length} persoane sub program`}
          />
        </StatTileRow>
      </div>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadBalances()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="mt-5">
        <DataTable
          storageKey="overtime-balances-list"
          columns={columns}
          data={rows}
          rowKey={(row) => row.person.id}
          loading={loading}
          emptyMessage="Nicio persoană găsită."
        />
      </div>

      {!loading && !error && rows.length > 0 ? (
        <p className="mt-3 text-xs text-text-muted">
          Soldul acoperă doar luna curentă plus reportul din luna precedentă — orele mai
          vechi au fost deja plătite sau recuperate. O sâmbătă lucrată e o zi de 7,5 h:
          doar ce trece de ea intră în sold; duminica intră oră cu oră.{' '}
          {settledThroughLabel(rows)}
        </p>
      ) : null}
    </div>
  );
}
