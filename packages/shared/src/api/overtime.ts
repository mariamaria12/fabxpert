import { request, requestBlob } from './client';
import type {
  AccountingTimesheetResponse,
  ReopenAccountingMonthResponse,
  ResolveAccountingDaysInput,
  ResolveAccountingDaysResponse,
  OvertimeApprovalsPendingResponse,
  OvertimeBalanceDto,
  OvertimeBalancesResponse,
  OvertimeSettlementPreviewResponse,
  SettleOvertimeMonthResponse,
} from '../dto/overtime.dto';

export function getMyOvertimeBalance() {
  return request<OvertimeBalanceDto>('/overtime/my-balance');
}

export function getOvertimeBalance(personId: string) {
  return request<OvertimeBalanceDto>(`/overtime/balance/${personId}`);
}

/** Admin only. Overtime balance for every person, in one call. */
export function listOvertimeBalances() {
  return request<OvertimeBalancesResponse>('/overtime/balances');
}

/** Admin only. What settling `month` would pay out, before committing to it. */
export function previewOvertimeSettlement(month: string) {
  return request<OvertimeSettlementPreviewResponse>(
    `/overtime/settlement-preview?month=${encodeURIComponent(month)}`,
  );
}

/**
 * Admin only. `month` is `YYYY-MM` and must already be over. Anyone left out of
 * `reserveMinutesByPerson` is paid their whole balance, or keeps the reserve
 * from an earlier approval. `personIds` approves only those people; absent,
 * the whole month is approved at once.
 */
export function settleOvertimeMonth(
  month: string,
  reserveMinutesByPerson: Record<string, number> = {},
  personIds?: string[],
) {
  return request<SettleOvertimeMonthResponse>('/overtime/settle-month', {
    method: 'POST',
    body: JSON.stringify({
      month,
      reserveMinutesByPerson,
      ...(personIds ? { personIds } : {}),
    }),
  });
}

/** Admin only. How many people still wait for last month's approval. */
export function getOvertimeApprovalsPendingCount() {
  return request<OvertimeApprovalsPendingResponse>('/overtime/approvals-pending-count');
}

/** Admin only. The pontaj for accounting of `month` (`YYYY-MM`), recomputed on every call. */
export function getAccountingTimesheet(month: string) {
  return request<AccountingTimesheetResponse>(
    `/overtime/accounting?month=${encodeURIComponent(month)}`,
  );
}

/**
 * Admin only. Generates the pontaj document for accounting and closes the
 * month — reversible with `reopenAccountingMonth`.
 */
export function exportAccountingTimesheetXlsx(month: string) {
  return requestBlob(`/overtime/accounting/export?month=${encodeURIComponent(month)}`, {
    method: 'POST',
  });
}

/**
 * Admin only. Fills working days that have neither a pontaj nor leave: an X
 * with no hours, or an approved single-day leave.
 */
export function resolveAccountingDays(input: ResolveAccountingDaysInput) {
  return request<ResolveAccountingDaysResponse>('/overtime/accounting/resolve-days', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

/** Admin only. Reopens a month closed by the export. */
export function reopenAccountingMonth(month: string) {
  return request<ReopenAccountingMonthResponse>(
    `/overtime/accounting/export?month=${encodeURIComponent(month)}`,
    { method: 'DELETE' },
  );
}
