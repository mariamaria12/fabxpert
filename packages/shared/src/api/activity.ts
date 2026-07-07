import { request } from './client';
import type {
  ActivityDto,
  CreateActivityInput,
  UpdateActivityInput,
} from '../dto/activity.dto';

export function listActivities(includeInactive?: boolean) {
  const searchParams = new URLSearchParams();
  if (includeInactive === true) {
    searchParams.set('includeInactive', 'true');
  }
  const query = searchParams.toString();
  return request<ActivityDto[]>(`/activities${query ? `?${query}` : ''}`);
}

export function getActivity(id: string) {
  return request<ActivityDto>(`/activities/${id}`);
}

export function createActivity(input: CreateActivityInput) {
  return request<ActivityDto>('/activities', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function updateActivity(id: string, input: UpdateActivityInput) {
  return request<ActivityDto>(`/activities/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}

export function deleteActivity(id: string) {
  return request<void>(`/activities/${id}`, { method: 'DELETE' });
}
