'use client';

import {
  getLeaveBalance,
  reviewLeaveRequest,
  type LeaveBalanceDto,
  type LeaveRequestDto,
} from '@fabxpert/shared';
import { useEffect, useMemo, useState } from 'react';
import { SlideOverPanel } from '@/components/SlideOverPanel';
import { PersonName } from '@/components/PersonAvatar';
import { useToast } from '@/context/ToastContext';
import { apiErrorToastMessage } from '@/utils/apiToastMessage';
import {
  formatLeaveDateRange,
  formatLeaveDayCount,
  getLeaveStatusBadgeClassName,
  getLeaveStatusLabel,
  getLeaveTypeLabel,
  formatReviewedAt,
} from '@/utils/leaveFormat';

interface LeaveReviewPanelProps {
  open: boolean;
  request: LeaveRequestDto;
  onClose: () => void;
  onReviewed: (updated: LeaveRequestDto) => void;
}

export function LeaveReviewPanel({
  open,
  request,
  onClose,
  onReviewed,
}: LeaveReviewPanelProps) {
  const { showToast } = useToast();
  const [balance, setBalance] = useState<LeaveBalanceDto | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open) {
      return;
    }

    let cancelled = false;
    setBalanceLoading(true);

    void getLeaveBalance(request.person.id)
      .then((response) => {
        if (!cancelled) {
          setBalance(response);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBalance(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setBalanceLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [open, request.person.id, request.id]);

  const balanceContext = useMemo(() => {
    if (request.type !== 'ODIHNA' || !balance) {
      return null;
    }

    const alreadyApproved = request.status === 'APROBAT';
    const usedWithoutThis = alreadyApproved
      ? balance.usedDays - request.dayCount
      : balance.usedDays;
    const remainingBefore = balance.annualLeaveDays - usedWithoutThis;
    const remainingAfterApprove = remainingBefore - request.dayCount;

    return {
      remainingBefore,
      remainingAfterApprove,
      overBalanceOnApprove: remainingAfterApprove < 0,
    };
  }, [balance, request]);

  async function handleReview(status: 'APROBAT' | 'RESPINS') {
    if (isSubmitting) {
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await reviewLeaveRequest(request.id, { status });
      const toastMessage =
        status === 'APROBAT' ? 'Cerere aprobată' : 'Cerere respinsă';
      showToast(toastMessage, 'success');

      if (response.overBalanceWarning) {
        showToast('Atenție: cererea depășește soldul de odihnă.', 'error');
      }

      onReviewed(response.leaveRequest);
      onClose();
    } catch (caught) {
      showToast(apiErrorToastMessage(caught), 'error');
    } finally {
      setIsSubmitting(false);
    }
  }

  const footer = (
    <div className="flex flex-col gap-2">
      {request.status === 'IN_ASTEPTARE' ? (
        <div className="flex gap-2">
          <button
            type="button"
            className="flex-1 rounded-md bg-status-livrat-bg px-4 py-2.5 text-sm font-medium text-status-livrat-text transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => void handleReview('APROBAT')}
          >
            {isSubmitting ? 'Se procesează…' : 'Aprobă'}
          </button>
          <button
            type="button"
            className="flex-1 rounded-md bg-status-anulat-bg px-4 py-2.5 text-sm font-medium text-status-anulat-text transition-opacity hover:opacity-90 disabled:opacity-50"
            disabled={isSubmitting}
            onClick={() => void handleReview('RESPINS')}
          >
            Respinge
          </button>
        </div>
      ) : request.status === 'APROBAT' ? (
        <button
          type="button"
          className="w-full rounded-md bg-status-anulat-bg px-4 py-2.5 text-sm font-medium text-status-anulat-text transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={isSubmitting}
          onClick={() => void handleReview('RESPINS')}
        >
          {isSubmitting ? 'Se procesează…' : 'Schimbă în Respins'}
        </button>
      ) : (
        <button
          type="button"
          className="w-full rounded-md bg-status-livrat-bg px-4 py-2.5 text-sm font-medium text-status-livrat-text transition-opacity hover:opacity-90 disabled:opacity-50"
          disabled={isSubmitting}
          onClick={() => void handleReview('APROBAT')}
        >
          {isSubmitting ? 'Se procesează…' : 'Schimbă în Aprobat'}
        </button>
      )}
      <button
        type="button"
        className="w-full rounded-md border border-border px-4 py-2.5 text-sm text-text-secondary transition-colors hover:bg-surface-raised hover:text-text-primary disabled:opacity-50"
        disabled={isSubmitting}
        onClick={onClose}
      >
        Închide
      </button>
    </div>
  );

  return (
    <SlideOverPanel
      open={open}
      title="Revizuire cerere"
      onClose={onClose}
      disableClose={isSubmitting}
      footer={footer}
    >
      <div className="flex flex-col gap-5">
        <div>
          <p className="text-xs text-text-muted">Angajat</p>
          <div className="mt-1 text-sm text-text-primary">
            <PersonName person={request.person} nameClassName="font-medium" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-text-muted">Tip</p>
            <p className="mt-1 text-sm text-text-primary">{getLeaveTypeLabel(request.type)}</p>
          </div>
          <div>
            <p className="text-xs text-text-muted">Zile</p>
            <p className="mt-1 text-sm text-text-primary">{formatLeaveDayCount(request.dayCount)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-muted">Perioadă</p>
          <p className="mt-1 text-sm text-text-primary">
            {formatLeaveDateRange(request.startDate, request.endDate, { includeYear: true })}
          </p>
        </div>

        <div>
          <p className="text-xs text-text-muted">Status curent</p>
          <div className="mt-2">
            <span
              className={`inline-flex rounded px-2 py-0.5 text-xs font-medium ${getLeaveStatusBadgeClassName(request.status)}`}
            >
              {getLeaveStatusLabel(request.status)}
            </span>
          </div>
        </div>

        <div>
          <p className="text-xs text-text-muted">Motiv</p>
          <p className="mt-1 whitespace-pre-wrap text-sm text-text-primary">
            {request.reason?.trim() ? request.reason : '—'}
          </p>
        </div>

        {request.reviewedBy ? (
          <div>
            <p className="text-xs text-text-muted">Revizuit</p>
            <p className="mt-1 text-sm text-text-secondary">
              {request.reviewedBy.email}
              {request.reviewedAt ? ` · ${formatReviewedAt(request.reviewedAt)}` : ''}
            </p>
          </div>
        ) : null}

        {request.type === 'ODIHNA' ? (
          <div className="rounded-md border border-border-subtle bg-surface-raised px-4 py-3">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">
              Sold concediu de odihnă
            </p>
            {balanceLoading ? (
              <p className="mt-2 text-sm text-text-muted">Se încarcă soldul…</p>
            ) : balance && balanceContext ? (
              <div className="mt-2 space-y-1 text-sm text-text-secondary">
                <p>
                  Rămase acum: <strong className="text-text-primary">{balanceContext.remainingBefore}</strong> zile
                </p>
                {request.status !== 'APROBAT' ? (
                  <p>
                    Dacă se aprobă:{' '}
                    <strong className="text-text-primary">
                      {balanceContext.remainingAfterApprove}
                    </strong>{' '}
                    zile rămase
                  </p>
                ) : null}
                {balanceContext.overBalanceOnApprove && request.status !== 'APROBAT' ? (
                  <p className="text-danger">
                    Depășește soldul: rămân {balanceContext.remainingBefore} zile, cererea are{' '}
                    {request.dayCount} zile.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-sm text-text-muted">Sold indisponibil.</p>
            )}
          </div>
        ) : null}
      </div>
    </SlideOverPanel>
  );
}
