'use client';

import {
  listLeaveRequests,
  listPersons,
  reviewLeaveRequest,
  LEAVE_TYPE_OPTIONS,
  type LeaveRequestDto,
  type LeaveStatus,
  type LeaveType,
} from '@fabxpert/shared';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { LeaveFormPanel } from './LeaveFormPanel';
import { LeaveReviewPanel } from './LeaveReviewPanel';
import { DataTable, type DataTableColumn } from '@/components/DataTable';
import { Pagination } from '@/components/Pagination';
import { SearchableSelect } from '@/components/SearchableSelect';
import {
  filterChipClassName,
  FILTER_CHIP_TOGGLE_CLASS,
} from '@/components/filterChipStyles';
import { PersonName } from '@/components/PersonAvatar';
import { useLeavePendingCount } from '@/context/LeavePendingCountContext';
import { useToast } from '@/context/ToastContext';
import { useIsMobile } from '@/hooks/useIsMobile';
import { loadAllPages } from '@/utils/loadAllPages';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import { removeById, replaceById } from '@/utils/replaceById';
import {
  formatLeaveDateRange,
  formatLeaveDuration,
  formatReviewedAt,
  getLeaveStatusBadgeClassName,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  truncateReason,
} from '@/utils/leaveFormat';
import { LeaveRequestExportButton } from './LeaveRequestExportButton';

const PAGE_SIZE = 20;

type StatusFilter = LeaveStatus | 'ALL';

const LEAVE_TYPE_FILTER_OPTIONS = LEAVE_TYPE_OPTIONS.map((option) => ({
  id: option.value,
  label: option.label,
}));

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
  const isMobile = useIsMobile();
  const [showAllStatuses, setShowAllStatuses] = useState(false);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('IN_ASTEPTARE');
  const [typeFilter, setTypeFilter] = useState<LeaveType | null>(null);
  const [personId, setPersonId] = useState<string | null>(null);
  const [personOptions, setPersonOptions] = useState<{ id: string; label: string }[]>([]);
  const [page, setPage] = useState(1);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<PanelState>({ open: false });
  const [editRequest, setEditRequest] = useState<LeaveRequestDto | null>(null);
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
  }, [statusFilter, typeFilter, personId]);

  const selectedPersonLabel = useMemo(() => {
    if (!personId) {
      return undefined;
    }

    return personOptions.find((option) => option.id === personId)?.label;
  }, [personId, personOptions]);

  const loadRequests = useCallback(
    async (
      targetPage: number,
      filter: StatusFilter,
      filterType: LeaveType | null,
      filterPersonId: string | null,
    ) => {
      setLoading(true);
      setError(null);

      try {
        const response = await listLeaveRequests({
          page: targetPage,
          pageSize: PAGE_SIZE,
          ...(filter !== 'ALL' ? { status: filter } : {}),
          ...(filterType ? { type: filterType } : {}),
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
    void loadRequests(page, statusFilter, typeFilter, personId);
  }, [page, statusFilter, typeFilter, personId, loadRequests, refreshToken]);

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

  function openEdit(request: LeaveRequestDto) {
    setPanel({ open: false });
    setEditRequest(request);
  }

  // An edit can move the row out of the active type or person filter, so the
  // page is reloaded instead of patched in place.
  function handleEdited() {
    void loadRequests(page, statusFilter, typeFilter, personId);
    void refreshPendingCount();
    onBalancesRefresh?.();
  }

  function handleDeleted(deletedId: string) {
    setRequests((current) => removeById(current, deletedId).items);
    setTotal((current) => Math.max(0, current - 1));
    void refreshPendingCount();
    onBalancesRefresh?.();
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
    const showReject = row.status === 'IN_ASTEPTARE';

    const iconButtonClass =
      'flex size-8 shrink-0 items-center justify-center rounded-md border border-border-subtle transition-colors hover:bg-surface-raised disabled:opacity-50';

    return (
      <div
        className="flex items-center justify-end gap-1.5"
        onClick={(event) => event.stopPropagation()}
      >
        <LeaveRequestExportButton
          request={row}
          className={`${iconButtonClass} text-text-secondary hover:text-text-primary`}
        />
        <button
          type="button"
          disabled={isBusy}
          aria-label="Editează"
          title="Editează"
          className={`${iconButtonClass} text-text-secondary hover:text-text-primary`}
          onClick={() => openEdit(row)}
        >
          <i className="ti ti-pencil text-base" aria-hidden="true" />
        </button>
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
        ) : null}
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
        ) : null}
      </div>
    );
  }

  // Phones show only the first two chips (plus whatever is selected); the rest
  // sit behind the chevron so the row never wraps.
  const visibleStatusFilters =
    isMobile && !showAllStatuses
      ? STATUS_FILTERS.filter((filter, index) => index < 2 || filter.id === statusFilter)
      : STATUS_FILTERS;

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
      header: 'Durată',
      width: '70px',
      className: 'text-text-secondary',
      render: (row) => formatLeaveDuration(row),
    },
    {
      key: 'reason',
      header: 'Motiv',
      className: 'max-w-[10rem]',
      render: (row) =>
        row.reason?.trim() ? (
          <span className="block truncate" title={row.reason}>
            {truncateReason(row.reason)}
          </span>
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
      className: 'max-w-[12rem] truncate',
      render: (row) =>
        row.reviewedBy ? (
          <span className="block truncate text-text-secondary" title={`${row.reviewedBy.email}${row.reviewedAt ? ` · ${formatReviewedAt(row.reviewedAt)}` : ''}`}>
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
      width: '170px',
      className: 'overflow-visible text-right',
      render: (row) => renderRowActions(row),
    },
  ];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-1.5">
        {visibleStatusFilters.map((filter) => {
          const selected = statusFilter === filter.id;

          return (
            <button
              key={filter.id}
              type="button"
              aria-pressed={selected}
              onClick={() => setStatusFilter(filter.id)}
              className={filterChipClassName(selected)}
            >
              <span className="font-medium">{filter.label}</span>
            </button>
          );
        })}

        {isMobile && (
          <button
            type="button"
            onClick={() => setShowAllStatuses((current) => !current)}
            aria-expanded={showAllStatuses}
            aria-label={
              showAllStatuses ? 'Ascunde celelalte filtre' : 'Afișează celelalte filtre'
            }
            className={FILTER_CHIP_TOGGLE_CLASS}
          >
            <i
              className={`ti ${showAllStatuses ? 'ti-chevron-up' : 'ti-chevron-down'} text-base`}
              aria-hidden="true"
            />
          </button>
        )}
      </div>

      <div className="mt-4 grid max-w-3xl gap-3 sm:grid-cols-2">
        <SearchableSelect
          id="leave-type-filter"
          label="Tip"
          placeholder="Toate tipurile"
          emptyMessage="Niciun tip găsit."
          value={typeFilter}
          options={LEAVE_TYPE_FILTER_OPTIONS}
          onChange={(value) => setTypeFilter(value as LeaveType | null)}
        />
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
            onClick={() => void loadRequests(page, statusFilter, typeFilter, personId)}
            className="shrink-0 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary"
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      <div className="mt-6">
        <DataTable
          storageKey="leave-requests-list"
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
          onEdit={openEdit}
        />
      ) : null}

      {editRequest ? (
        <LeaveFormPanel
          open
          mode="edit"
          request={editRequest}
          onClose={() => setEditRequest(null)}
          onSaved={handleEdited}
          onDeleted={handleDeleted}
        />
      ) : null}
    </div>
  );
}
