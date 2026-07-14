'use client';

import { getOnLeave, type LeaveRequestDto } from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { PersonName } from '@/components/PersonAvatar';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { formatLeaveDateRange, getLeaveTypeLabel } from '@/utils/leaveFormat';
import { useRegisterPanouRefetch } from '../PanouRefreshContext';
import { usePanouDashboard } from './PanouDashboardContext';

function useOnLeaveTableColumns(): DataTableColumn<LeaveRequestDto>[] {
  return useMemo(
    (): DataTableColumn<LeaveRequestDto>[] => [
      {
        key: 'person',
        header: 'Angajat',
        render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
      },
      {
        key: 'type',
        header: 'Tip Concediu',
        width: '120px',
        render: (row) => getLeaveTypeLabel(row.type),
      },
      {
        key: 'period',
        header: 'Perioadă',
        render: (row) =>
          formatLeaveDateRange(row.startDate, row.endDate, { includeYear: true }),
      },
      {
        key: 'dayCount',
        header: 'Zile',
        width: '70px',
        className: 'text-text-secondary tabular-nums',
        render: (row) => row.dayCount,
      },
    ],
    [],
  );
}

export function PanouOnLeaveView() {
  const { period, periodReady } = usePanouDashboard();
  const columns = useOnLeaveTableColumns();
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadOnLeave = useCallback(
    async (background = false) => {
      if (!periodReady) {
        return;
      }

      if (!background) {
        setLoading(true);
      }
      setError(null);

      try {
        const response = await getOnLeave(period);
        setRequests(response.requests);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [period, periodReady],
  );

  useEffect(() => {
    void loadOnLeave();
  }, [loadOnLeave]);

  const refetchOnLeave = useCallback(async () => {
    await loadOnLeave(true);
  }, [loadOnLeave]);

  useRegisterPanouRefetch('panou-on-leave', refetchOnLeave);

  const showEmptyState = !loading && !error && requests.length === 0;
  const waitingForCustomRange = !periodReady;

  return (
    <section className="mt-6">
      {error && (
        <div className="flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void refetchOnLeave()}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      )}

      {waitingForCustomRange && (
        <p className="text-sm text-text-muted">Selectează intervalul de date.</p>
      )}

      {loading && requests.length === 0 && !error && !waitingForCustomRange && (
        <p className="text-sm text-text-muted">Se încarcă…</p>
      )}

      {showEmptyState && (
        <p className="text-sm text-text-muted">Nimeni nu este în concediu în perioada selectată.</p>
      )}

      {(loading || requests.length > 0) && (
        <DataTable
          columns={columns}
          data={requests}
          rowKey={(row) => row.id}
          loading={loading}
        />
      )}
    </section>
  );
}
