'use client';

import {
  getLeaveBalance,
  listPersons,
  type LeaveBalanceDto,
  type PersonDto,
} from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { LeaveAllocationPanel } from './LeaveAllocationPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { loadAllPages } from '@/utils/loadAllPages';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';

type BalanceRow = {
  person: PersonDto;
  balance: LeaveBalanceDto | null;
};

type PanelState =
  | { open: false }
  | { open: true; person: PersonDto; balance: LeaveBalanceDto | null };

interface LeaveBalancesTabProps {
  refreshToken: number;
}

export function LeaveBalancesTab({ refreshToken }: LeaveBalancesTabProps) {
  const [rows, setRows] = useState<BalanceRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });

  // MVP: one getLeaveBalance call per person after listing persons.
  // Flag for post-MVP: a single admin balances endpoint would avoid N+1.
  const loadBalances = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const persons = await loadAllPages((page, pageSize) => listPersons(page, pageSize));
      const balances = await Promise.all(
        persons.map(async (person) => {
          try {
            const balance = await getLeaveBalance(person.id);
            return { person, balance };
          } catch {
            return { person, balance: null };
          }
        }),
      );
      setRows(balances);
    } catch (caught) {
      setError(apiErrorToastMessage(caught));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBalances();
  }, [loadBalances, refreshToken]);

  function openAllocation(row: BalanceRow) {
    setPanel({ open: true, person: row.person, balance: row.balance });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  function handleSaved() {
    void loadBalances();
  }

  const columns: DataTableColumn<BalanceRow>[] = [
    {
      key: 'person',
      header: 'Angajat',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'annualLeaveDays',
      header: 'Zile alocate',
      width: '110px',
      className: 'text-text-secondary',
      render: (row) => row.person.annualLeaveDays,
    },
    {
      key: 'usedDays',
      header: 'Folosite',
      width: '90px',
      className: 'text-text-secondary',
      render: (row) => (row.balance ? row.balance.usedDays : '—'),
    },
    {
      key: 'remainingDays',
      header: 'Rămase',
      width: '90px',
      render: (row) =>
        row.balance ? (
          <span className="font-medium text-text-primary">{row.balance.remainingDays}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '120px',
      render: (row) => (
        <button
          type="button"
          className="text-sm text-accent hover:underline"
          onClick={(event) => {
            event.stopPropagation();
            openAllocation(row);
          }}
        >
          Editează alocarea
        </button>
      ),
    },
  ];

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
          columns={columns}
          data={rows}
          rowKey={(row) => row.person.id}
          loading={loading}
          emptyMessage="Nicio persoană găsită."
          onRowClick={loading ? undefined : openAllocation}
        />
      </div>

      {panel.open ? (
        <LeaveAllocationPanel
          open
          person={panel.person}
          balance={panel.balance}
          onClose={closePanel}
          onSaved={handleSaved}
        />
      ) : null}
    </div>
  );
}
