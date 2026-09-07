import { request } from './client';
import type {
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
 * `reserveMinutesByPerson` is paid their whole balance.
 */
export function settleOvertimeMonth(
  month: string,
  reserveMinutesByPerson: Record<string, number> = {},
) {
  return request<SettleOvertimeMonthResponse>('/overtime/settle-month', {
    method: 'POST',
    body: JSON.stringify({ month, reserveMinutesByPerson }),
  });
}
