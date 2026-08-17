import { request } from './client';
import type {
  CloseOvertimeMonthResponse,
  OvertimeBalanceDto,
} from '../dto/overtime.dto';

export function getMyOvertimeBalance() {
  return request<OvertimeBalanceDto>('/overtime/my-balance');
}

export function getOvertimeBalance(personId: string) {
  return request<OvertimeBalanceDto>(`/overtime/balance/${personId}`);
}

/** Admin only. `month` is `YYYY-MM` and must already be over. */
export function closeOvertimeMonth(month: string) {
  return request<CloseOvertimeMonthResponse>('/overtime/close-month', {
    method: 'POST',
    body: JSON.stringify({ month }),
  });
}
