import { z } from 'zod';

export const NOTIFICATION_KIND_VALUES = [
  'TIMESHEET_REMINDER',
  'ANNOUNCEMENT',
  'POLL',
  'TASK_ASSIGNED',
  'TASK_COMPLETED',
  'TASK_COMMENTED',
] as const;
export const NOTIFICATION_SOURCE_VALUES = ['SYSTEM', 'ADMIN'] as const;

export type NotificationKind = (typeof NOTIFICATION_KIND_VALUES)[number];
export type NotificationSource = (typeof NOTIFICATION_SOURCE_VALUES)[number];

export interface NotificationDto {
  id: string;
  kind: NotificationKind;
  source: NotificationSource;
  title: string;
  body: string;
  createdAt: string;
  /** Display name of the admin who sent it; null for SYSTEM notifications. */
  createdByName: string | null;
  /** Set on POLL notifications — lets the app clear this exact one on answer. */
  pollId: string | null;
  /** Set on TASK_* notifications — the task to open. */
  taskId: string | null;
  /** When the user saw it in the web inbox; null while unread. */
  readAt: string | null;
}

/** The web inbox behind the bell: the latest notifications, read ones included. */
export interface NotificationInboxResponse {
  notifications: NotificationDto[];
  unreadCount: number;
}

/** Browser `PushSubscription` fields the API needs to send a push later. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2000),
  keys: z.object({
    p256dh: z.string().min(1).max(255),
    auth: z.string().min(1).max(255),
  }),
});

export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

export const unsubscribePushSchema = z.object({
  endpoint: z.string().url().max(2000),
});

export type UnsubscribePushInput = z.infer<typeof unsubscribePushSchema>;

export interface PushPublicKeyResponse {
  /** Base64url VAPID public key, or null when push isn't configured on the server. */
  publicKey: string | null;
}

export const sendTimesheetReminderSchema = z.object({
  personId: z.string().trim().min(1),
});

export type SendTimesheetReminderInput = z.infer<typeof sendTimesheetReminderSchema>;

export interface SendTimesheetReminderResponse {
  /** Devices the push reached; 0 means the person hasn't allowed notifications. */
  pushDeviceCount: number;
}
