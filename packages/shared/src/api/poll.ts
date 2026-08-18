import { request } from './client';
import type {
  CreatePollInput,
  PollDto,
  PublishPollResponse,
  UpdatePollInput,
  VotePollInput,
} from '../dto/poll.dto';

/** Admin only — every poll, drafts included, newest first. */
export function listPolls() {
  return request<PollDto[]>('/polls');
}

/** Polls still running for the signed-in user — answered ones included. */
export function listActivePolls() {
  return request<PollDto[]>('/polls/active');
}

export function getPoll(id: string) {
  return request<PollDto>(`/polls/${id}`);
}

export function createPoll(input: CreatePollInput) {
  return request<PollDto>('/polls', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updatePoll(id: string, input: UpdatePollInput) {
  return request<PollDto>(`/polls/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

/** Opens the poll for answers and notifies the team. */
export function publishPoll(id: string) {
  return request<PublishPollResponse>(`/polls/${id}/publish`, { method: 'POST' });
}

export function closePoll(id: string) {
  return request<PollDto>(`/polls/${id}/close`, { method: 'POST' });
}

/** Puts a closed poll back in front of the team, without notifying again. */
export function reopenPoll(id: string) {
  return request<PollDto>(`/polls/${id}/reopen`, { method: 'POST' });
}

export function deletePoll(id: string) {
  return request<void>(`/polls/${id}`, { method: 'DELETE' });
}

export function votePoll(id: string, input: VotePollInput) {
  return request<PollDto>(`/polls/${id}/vote`, {
    method: 'POST',
    body: JSON.stringify(input),
  });
}
