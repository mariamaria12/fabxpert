import {
  getMyLeaveBalance,
  listMyLeaveRequests,
  ApiError,
} from '@fabxpert/shared';
import type { LeaveBalanceDto, LeaveRequestDto } from '@fabxpert/shared';
import { useCallback, useEffect, useState } from 'react';
import { MobileErrorScreen } from './MobileErrorScreen';
import {
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusLabel,
  getLeaveStatusPillClassName,
  getLeaveTypeLabel,
} from '../utils/leaveUtils';

interface MyLeaveRequestsProps {
  refreshToken: number;
  onCreateNew: () => void;
  onEditRequest: (request: LeaveRequestDto) => void;
}

function ChevronRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M9 6l6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function MyLeaveRequests({
  refreshToken,
  onCreateNew,
  onEditRequest,
}: MyLeaveRequestsProps) {
  const [balance, setBalance] = useState<LeaveBalanceDto | null>(null);
  const [requests, setRequests] = useState<LeaveRequestDto[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const loadInitial = useCallback(async () => {
    setIsLoading(true);
    setConnectionError(false);
    setLoadError(null);

    try {
      const [balanceResponse, listResponse] = await Promise.all([
        getMyLeaveBalance(),
        listMyLeaveRequests(1),
      ]);

      setBalance(balanceResponse);
      setRequests(listResponse.data);
      setPage(listResponse.meta.page);
      setTotalPages(listResponse.meta.totalPages);
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 0) {
        setConnectionError(true);
      } else {
        setLoadError('A apărut o eroare la încărcare.');
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadInitial();
  }, [loadInitial, refreshToken]);

  async function handleLoadMore() {
    if (isLoadingMore || page >= totalPages) {
      return;
    }

    setIsLoadingMore(true);

    try {
      const nextPage = page + 1;
      const response = await listMyLeaveRequests(nextPage);
      setRequests((current) => [...current, ...response.data]);
      setPage(response.meta.page);
      setTotalPages(response.meta.totalPages);
    } catch {
      setLoadError('A apărut o eroare la încărcare.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  if (connectionError && !isLoading) {
    return <MobileErrorScreen onRetry={() => void loadInitial()} />;
  }

  return (
    <div className="flow-content my-leave-content">
      {balance ? (
        <section className="leave-balance-card" aria-label="Sold concediu de odihnă">
          <p className="leave-balance-label">Concediu de odihnă</p>
          <p className="leave-balance-remaining">
            Zile rămase: <strong>{balance.remainingDays}</strong>
          </p>
          <p className="leave-balance-secondary">
            din {balance.annualLeaveDays} zile · {balance.usedDays} folosite
          </p>
        </section>
      ) : isLoading ? (
        <div className="leave-balance-card leave-balance-card-skeleton" aria-hidden="true">
          <span className="skeleton-block skeleton-line-title" />
          <span className="skeleton-block skeleton-line-subtitle" />
        </div>
      ) : null}

      <button
        type="button"
        className="flow-primary-button leave-new-button"
        disabled={isLoading}
        onClick={onCreateNew}
      >
        Cerere nouă
      </button>

      {loadError ? (
        <div className="flow-error-block">
          <p className="flow-error-text">{loadError}</p>
          <button
            type="button"
            className="flow-retry-button"
            onClick={() => void loadInitial()}
          >
            Reîncearcă
          </button>
        </div>
      ) : null}

      {!isLoading && !loadError && requests.length === 0 ? (
        <p className="flow-status">Nu ai nicio cerere de concediu.</p>
      ) : null}

      {!loadError && requests.length > 0 ? (
        <ul className="leave-request-list">
          {requests.map((request) => {
            const isPending = request.status === 'IN_ASTEPTARE';

            if (isPending) {
              return (
                <li key={request.id}>
                  <button
                    type="button"
                    className="leave-request-row leave-request-row-editable"
                    onClick={() => onEditRequest(request)}
                  >
                    <LeaveRequestRowBody request={request} />
                    <span className="leave-request-chevron">
                      <ChevronRightIcon />
                    </span>
                  </button>
                </li>
              );
            }

            return (
              <li key={request.id}>
                <div className="leave-request-row">
                  <LeaveRequestRowBody request={request} />
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {!isLoading && !loadError && page < totalPages ? (
        <button
          type="button"
          className="timesheet-load-more"
          disabled={isLoadingMore}
          onClick={() => void handleLoadMore()}
        >
          Încarcă mai multe
        </button>
      ) : null}
    </div>
  );
}

function LeaveRequestRowBody({ request }: { request: LeaveRequestDto }) {
  return (
    <>
      <span className="leave-request-body">
        <span className="leave-request-type">{getLeaveTypeLabel(request.type)}</span>
        <span className="leave-request-dates">
          {formatLeaveDateRange(request.startDate, request.endDate)}
          <span className="leave-request-day-count">
            {' · '}
            {formatLeaveDayCount(request.dayCount)}
          </span>
        </span>
      </span>
      <span className={getLeaveStatusPillClassName(request.status)}>
        {getLeaveStatusLabel(request.status)}
      </span>
    </>
  );
}
