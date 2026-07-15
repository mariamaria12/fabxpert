'use client';

import {
  listLeaveRequests,
  listPersons,
  reviewLeaveRequest,
  type LeaveRequestDto,
  type LeaveStatus,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeaveReviewPanel } from './LeaveReviewPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { SearchableSelect } from '@/components/SearchableSelect';
import { PersonName } from '@/components/PersonAvatar';
import { useLeavePendingCount } from '@/context/LeavePendingCountContext';
import { useToast } from '@/context/ToastContext';
import { loadAllPages } from '@/utils/loadAllPages';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { removeById, replaceById } from '@/utils/replaceById';
import {
  formatLeaveDateRange,
  formatReviewedAt,
  getLeaveStatusBadgeClassName,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  truncateReason,
} from '@/utils/leaveFormat';
import { LeaveRequestExportButton } from './LeaveRequestExportButton';

const PAGE_SIZE = 20;

type StatusFilter = LeaveStatus | 'ALL';

const STATUS_FILTERS: { id: StatusFilter; label: string }[] = [
  { id: 'IN_ASTEPTARE', label: 'În așteptare' },
  { id: 'APROBAT', label: 'Aprobate' },
  { id: 'RESPINS', label: 'Respinse' },
  { id: 'ALL', label: 'Toate' },
];

function emptyMessageForFilter(filter: StatusFilter): string {
  switch (filter) {
    case 'IN_ASTEPTARE':
      return 'Nicio cerere în așteptare.';
    case 'APROBAT':
      return 'Nicio cerere aprobată.';
    case 'RESPINS':
      return 'Nicio cerere respinsă.';
    default:
      return 'Nicio cerere de concediu.';
  }
}

type PanelState =
  | { open: false }
  | { open: true; request: LeaveRequestDto };

interface LeaveRequestsTabProps {
  onBalancesRefresh?: () => void;
  refreshToken?: number;
}

export function LeaveRequestsTab({ onBalancesRefresh, refreshToken = 0 }: LeaveRequestsTabProps) {
  const { showToast } = useToast();
  const { refreshPendingCount } = useLeavePendingCount();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('IN_ASTEPTARE');
  const [personId, setPersonId] = useState<string | null>(null);
  const [personOptions, setPersonOptions] = useState<{ id: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [reviewingId, setReviewingId] = useState<string | null>(null);

  useEffect(() => {
    void loadAllPages((targetPage, pageSize) => listPersons({ page: targetPage, pageSize }))
      .then((persons) => {
        setPersonOptions(
          persons.map((person) => ({
            id: person.id,
            label: `${person.firstName} ${person.lastName}`,
          })),
        );
      })
      .catch(() => {
        // Person filter is optional — list still works without it.
      });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, personId]);

  const selectedPersonLabel = useMemo(() => {
    if (!personId) {
      return undefined;
    }

    return personOptions.find((option) => option.id === personId)?.label;
  }, [personId, personOptions]);

  const loadRequests = useCallback(
    async (targetPage: number, filter: StatusFilter, filterPersonId: string | null) => {
      setLoading(true);
      setError(null);

      try {
        const response = await listLeaveRequests({
          page: targetPage,
          pageSize: PAGE_SIZE,
          ...(filter !== 'ALL' ? { status: filter } : {}),
          ...(filterPersonId ? { personId: filterPersonId } : {}),
        });
        setRequests(response.data);
        setTotal(response.meta.total);
      } catch (caught) {
        setError(apiErrorToastMessage(caught));
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadRequests(page, statusFilter, personId);
  }, [page, statusFilter, personId, loadRequests, refreshToken]);

  function openReview(request: LeaveRequestDto) {
    setPanel({ open: true, request });
  }

  function closePanel() {
    setPanel({ open: false });
  }

  // Review changes status: if the row no longer matches the active status filter,
  // remove it locally instead of swapping in place (e.g. approve under "În așteptare").
  function applyReviewedRequest(updated: LeaveRequestDto) {
    const stillVisible = statusFilter === 'ALL' || statusFilter === updated.status;

    setRequests((current) => {
      if (!stillVisible) {
        return removeById(current, updated.id).items;
      }

      return replaceById(current, updated);
    });

    if (!stillVisible) {
      setTotal((current) => Math.max(0, current - 1));
    }

    void refreshPendingCount();
    onBalancesRefresh?.();
  }

  function handleReviewed(updated: LeaveRequestDto) {
    applyReviewedRequest(updated);
  }

  async function handleQuickReview(
    request: LeaveRequestDto,
    status: 'APROBAT' | 'RESPINS',
  ) {
    if (reviewingId) {
      return;
    }

    setReviewingId(request.id);

    try {
      const response = await reviewLeaveRequest(request.id, { status });
      showToast(status === 'APROBAT' ? 'Cerere aprobată' : 'Cerere respinsă', 'success');

      if (response.overBalanceWarning) {
        showToast('Atenție: cererea depășește soldul de odihnă.', 'error');
      }

      handleReviewed(response.leaveRequest);
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setReviewingId(null);
    }
  }

  function renderRowActions(row: LeaveRequestDto) {
    const isBusy = reviewingId === row.id;
    const showApprove = row.status !== 'APROBAT';
    const showReject = row.status !== 'RESPINS';

    const iconButtonClass =
      'flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle transition-colors hover:bg-surface-raised disabled:opacity-50';

    return (
      <div
        className="inline-flex items-center justify-end gap-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <LeaveRequestExportButton
          request={row}
          className={`${iconButtonClass} text-text-secondary hover:text-text-primary`}
        />
        {showApprove ? (
          <button
            type="button"
            disabled={isBusy}
            aria-label="Aprobă"
            title="Aprobă"
            className={`${iconButtonClass} text-success`}
            onClick={() => void handleQuickReview(row, 'APROBAT')}
          >
            <i className="ti ti-check text-base" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-8 shrink-0" aria-hidden="true" />
        )}
        {showReject ? (
          <button
            type="button"
            disabled={isBusy}
            aria-label="Respinge"
            title="Respinge"
            className={`${iconButtonClass} text-danger`}
            onClick={() => void handleQuickReview(row, 'RESPINS')}
          >
            <i className="ti ti-x text-base" aria-hidden="true" />
          </button>
        ) : (
          <span className="size-8 shrink-0" aria-hidden="true" />
        )}
      </div>
    );
  }

  const columns: DataTableColumn<LeaveRequestDto>[] = [
    {
      key: 'person',
      header: 'Angajat',
      render: (row) => <PersonName person={row.person} nameClassName="font-medium" />,
    },
    {
      key: 'type',
      header: 'Tip',
      width: '100px',
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
      className: 'text-text-secondary',
      render: (row) => row.dayCount,
    },
    {
      key: 'reason',
      header: 'Motiv',
      render: (row) =>
        row.reason?.trim() ? (
          <span title={row.reason}>{truncateReason(row.reason)}</span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '120px',
      render: (row) => (
        <span
          className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getLeaveStatusBadgeClassName(row.status)}`}
        >
          {getLeaveStatusLabel(row.status)}
        </span>
      ),
    },
    {
      key: 'reviewed',
      header: 'Revizuit',
      render: (row) =>
        row.reviewedBy ? (
          <span className="text-text-secondary">
            {row.reviewedBy.email}
            {row.reviewedAt ? ` · ${formatReviewedAt(row.reviewedAt)}` : ''}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'actions',
      header: '',
      width: '130px',
      className: 'overflow-visible text-right',
      render: (row) => renderRowActions(row),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((filter) => (
          <button
            key={filter.id}
            type="button"
            onClick={() => setStatusFilter(filter.id)}
            className={`rounded-md px-3 py-1.5 text-sm transition-colors ${
              statusFilter === filter.id
                ? 'bg-accent/15 text-accent'
                : 'border border-border text-text-secondary hover:bg-surface-raised hover:text-text-primary'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      <div className="mt-4 max-w-md">
        <SearchableSelect
          id="leave-person-filter"
          label="Angajat"
          placeholder="Toți angajații"
          emptyMessage="Nicio persoană găsită."
          value={personId}
          selectedLabel={selectedPersonLabel}
          options={personOptions}
          onChange={setPersonId}
        />
      </div>

      {error ? (
        <div className="mt-4 flex items-center justify-between gap-4 rounded-md border border-border-subtle bg-[var(--color-toast-error-bg)] px-4 py-3">
          <p className="text-sm text-danger">{error}</p>
          <button
            type="button"
            onClick={() => void loadRequests(page, statusFilter, personId)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <DataTable
          columns={columns}
          data={requests}
          rowKey={(row) => row.id}
          loading={loading}
          emptyMessage={emptyMessageForFilter(statusFilter)}
          onRowClick={loading ? undefined : openReview}
        />
        {!loading && total > 0 ? (
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={total}
            onPageChange={setPage}
          />
        ) : null}
      </div>

      {panel.open ? (
        <LeaveReviewPanel
          open
          request={panel.request}
          onClose={closePanel}
          onReviewed={handleReviewed}
        />
      ) : null}
    </div>
  );
}
