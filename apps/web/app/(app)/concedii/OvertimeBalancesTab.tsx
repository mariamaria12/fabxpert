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

interface OvertimeBalancesTabProps {
  refreshToken: number;
}

/** `closedThroughMonth` is the same for everyone in practice — show it once. */
function closedThroughLabel(rows: OvertimeBalanceRowDto[]): string | null {
  const months = new Set(
    rows.map((row) => row.balance.closedThroughMonth).filter((month): month is string => month !== null),
  );

  if (months.size === 0) {
    return null;
  }
  if (months.size === 1) {
    return `Luni închise până în ${[...months][0]}.`;
  }

  return 'Lunile închise diferă de la o persoană la alta.';
}

export function OvertimeBalancesTab({ refreshToken }: OvertimeBalancesTabProps) {
  const [rows, setRows] = useState<OvertimeBalanceRowDto[]>([]);
  const [loading, setLoading] = useState(true);
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
  }, [loadBalances, refreshToken]);

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
      key: 'accrued',
      header: 'Acumulate',
      width: '110px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) =>
        formatOvertimeHours(row.balance.accruedMinutes + row.balance.openPeriodMinutes),
    },
    {
      key: 'used',
      header: 'Folosite',
      width: '100px',
      className: 'text-right tabular-nums text-text-secondary',
      render: (row) => formatOvertimeHours(row.balance.usedMinutes),
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

  const closedThrough = closedThroughLabel(rows);

  return (
    <div>
      {error ? (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
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

      <div className={error ? 'mt-4' : ''}>
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
          Peste 9 ore pontate într-o zi intră în sold. Soldul scade când se ia liber în
          recuperare. {closedThrough}
        </p>
      ) : null}
    </div>
  );
}
