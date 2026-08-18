import type { PollStatus } from './dto/poll.dto';
import { parseWorkDateString } from './workDate';

export function getPollStatusLabel(status: PollStatus): string {
  switch (status) {
    case 'DRAFT':
      return 'Ciornă';
    case 'OPEN':
      return 'Deschis';
    case 'CLOSED':
      return 'Închis';
    default:
      return status;
  }
}

export function formatPollAnswerCount(count: number): string {
  return count === 1 ? '1 răspuns' : `${count} răspunsuri`;
}

/** Closing day as "16 iul" — the poll accepts answers all through that day. */
export function formatPollDeadline(closesOn: string): string {
  const date = parseWorkDateString(closesOn);
  const month = date.toLocaleDateString('ro-RO', { month: 'short' }).replace('.', '');
  return `${date.getDate()} ${month}`;
}
