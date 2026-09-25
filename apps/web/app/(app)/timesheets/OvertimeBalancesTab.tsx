'use client';

import {
  listOvertimeBalances,
  formatOvertimeBalance,
  formatOvertimeHours,
  type OvertimeBalanceRowDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { editActionColumn } from '@/components/editActionColumn';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { MonthPicker } from './MonthPicker';
import { OvertimeCorrectionPanel } from './OvertimeCorrectionPanel';
import { OvertimeRulesInfo } from './OvertimeInfo';
import { StatTile, StatTileRow } from './StatTile';
import { currentMonth, formatMonthLabel } from './timesheetMonths';

interface OvertimeBalancesTabProps {
  active: boolean;
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

/**
 * Step 2 of the flow: the running overtime balance of everyone, this month —
 * or a past month looked back at, where the balance can no longer be corrected.
 */
export function OvertimeBalancesTab({ active }: OvertimeBalancesTabProps) {
  const [month, setMonth] = useState(currentMonth);
  const [rows, setRows] = useState<OvertimeBalanceRowDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<OvertimeBalanceRowDto | null>(null);
  const loadSeqRef = useRef(0);
  const isCurrentMonth = month === currentMonth();

  const loadBalances = useCallback(async () => {
    // Paging through months fast must not let an older answer land last.
    const seq = ++loadSeqRef.current;
    setLoading(true);
    setError(null);

    try {
      const response = await listOvertimeBalances(month);
      if (seq === loadSeqRef.current) {
        setRows(response.rows);
      }
    } catch (caught) {
      if (seq === loadSeqRef.current) {
        setError(apiErrorToastMessage(caught));
      }
    } finally {
      if (seq === loadSeqRef.current) {
        setLoading(false);
      }
    }
  }, [month]);

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
      header: isCurrentMonth ? 'Luna aceasta' : 'Luna',
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
      render: (row) => (row.balance.saturdaysWorked === 0 ? '—' : row.balance.saturdaysWorked),
    },
    {
      key: 'paid',
      header: 'Aprobate la plată',
      width: '130px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) =>
        row.balance.paidMinutes === 0 ? '—' : formatOvertimeHours(row.balance.paidMinutes),
    },
    {
      key: 'remaining',
      header: 'Sold',
      width: '110px',
      className: 'text-right tabular-nums',
      render: (row) => (
        <span
          className={`inline-flex items-center justify-end gap-1 font-medium ${
            row.balance.remainingMinutes < 0 ? 'text-danger' : 'text-text-primary'
          }`}
        >
          {row.balance.correction ? (
            <i
              className="ti ti-adjustments text-sm text-text-muted"
              aria-label="Corectat manual"
              title={`Corectat manual la ${formatOvertimeBalance(row.balance.correction.balanceMinutes)}`}
            />
          ) : null}
          {formatOvertimeBalance(row.balance.remainingMinutes)}
        </span>
      ),
    },
    {
      key: 'days',
      header: 'Zile de recuperat',
      width: '100px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) => row.balance.remainingDays,
    },
    // A correction sets today's balance, so it is offered on the current month only.
    ...(isCurrentMonth
      ? [editActionColumn<OvertimeBalanceRowDto>((row) => setEditing(row), 'Corectează soldul')]
      : []),
  ];

  const positive = rows.filter((row) => row.balance.remainingMinutes > 0);
  const debts = rows.filter((row) => row.balance.remainingMinutes < 0);
  const totalPositive = positive.reduce((sum, row) => sum + row.balance.remainingMinutes, 0);
  const totalDebt = debts.reduce((sum, row) => sum + row.balance.remainingMinutes, 0);
  const totalUsed = rows.reduce((sum, row) => sum + row.balance.usedMinutes, 0);
  const anyApproved = rows.some((row) => row.balance.paidMinutes > 0);

  return (
    <div className="flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-1.5">
            <h1 className="text-[22px] font-medium text-text-primary">Ore suplimentare</h1>
            <OvertimeRulesInfo />
          </div>
          <p className="mt-0.5 text-sm text-text-muted">
            Soldul fiecăruia peste norma zilnică, {formatMonthLabel(month).toLowerCase()}. Se
            aprobă pentru plată la final de lună.
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
        </div>
      </div>

      <div className="mt-5 flex flex-wrap items-center gap-3">
        <MonthPicker value={month} onChange={setMonth} max={currentMonth()} />
      </div>

      <div className="mt-4">
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
            hint={anyApproved ? 'după orele aprobate la plată' : 'peste program, neaprobat încă'}
          />
          <StatTile
            label={isCurrentMonth ? 'Folosite luna aceasta' : 'Folosite în lună'}
            icon="ti-calendar-off"
            value={loading ? '—' : formatOvertimeHours(totalUsed)}
            hint="recuperări aprobate"
          />
          <StatTile
            label="Datorii"
            icon="ti-arrow-down-right"
            value={loading ? '—' : formatOvertimeBalance(totalDebt)}
            hint={
              debts.length === 1 ? '1 persoană sub program' : `${debts.length} persoane sub program`
            }
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
          Soldul acoperă doar luna afișată plus reportul din luna dinainte — orele mai vechi au
          fost deja plătite sau recuperate. O sâmbătă lucrată e o zi de 7,5 h: doar ce trece de ea
          intră în sold; duminica intră oră cu oră.{' '}
          {isCurrentMonth ? 'Creionul setează soldul manual. ' : ''}
          {settledThroughLabel(rows)}
        </p>
      ) : null}

      <OvertimeCorrectionPanel
        row={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          void loadBalances();
        }}
      />
    </div>
  );
}
