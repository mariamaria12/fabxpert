import { request } from './client';
import type {
  NotificationDto,
  PushPublicKeyResponse,
  PushSubscriptionInput,
  SendTimesheetReminderResponse,
} from '../dto/notification.dto';

/** Notifications still on screen for the current user (not yet dismissed). */
export function listMyNotifications(): Promise<NotificationDto[]> {
  return request<NotificationDto[]>('/notifications');
}

export function dismissNotification(id: string): Promise<void> {
  return request<void>(`/notifications/${id}/dismiss`, { method: 'POST' });
}

export function getPushPublicKey(): Promise<PushPublicKeyResponse> {
  return request<PushPublicKeyResponse>('/notifications/push/public-key');
}

export function subscribeToPush(subscription: PushSubscriptionInput): Promise<void> {
  return request<void>('/notifications/push/subscribe', {
    method: 'POST',
    body: JSON.stringify(subscription),
  });
}

export function unsubscribeFromPush(endpoint: string): Promise<void> {
  return request<void>('/notifications/push/unsubscribe', {
    method: 'POST',
    body: JSON.stringify({ endpoint }),
  });
}

/** Admin only — sends the pontaj reminder to one person right now. */
export function sendTimesheetReminder(
  personId: string,
): Promise<SendTimesheetReminderResponse> {
  return request<SendTimesheetReminderResponse>('/notifications/reminders/timesheet/send', {
    method: 'POST',
    body: JSON.stringify({ personId }),
  });
}
