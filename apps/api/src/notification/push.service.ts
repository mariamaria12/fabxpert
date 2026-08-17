import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import webpush, { WebPushError } from 'web-push';
import { PrismaService } from '../prisma/prisma.service';

export type PushPayload = {
  title: string;
  body: string;
  /** Collapses same-tag notifications in the tray instead of stacking them. */
  tag?: string;
};

/**
 * Web Push delivery. Disabled (and silently skipped) when the VAPID env vars
 * are missing, so local dev and the test suite don't need keys — check
 * `isEnabled` before promising a user that push will arrive.
 */
@Injectable()
export class PushService implements OnModuleInit {
  private readonly logger = new Logger(PushService.name);
  private publicKey: string | null = null;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit(): void {
    const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
    const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
    const subject = process.env.VAPID_SUBJECT?.trim() || 'mailto:admin@fabxpert.ro';

    if (!publicKey || !privateKey) {
      this.logger.warn(
        'VAPID keys not set — push notifications are disabled. In-app notifications still work.',
      );
      return;
    }

    webpush.setVapidDetails(subject, publicKey, privateKey);
    this.publicKey = publicKey;
  }

  get isEnabled(): boolean {
    return this.publicKey !== null;
  }

  getPublicKey(): string | null {
    return this.publicKey;
  }

  /**
   * Pushes to every device the user registered. Best effort: failures are
   * logged, never thrown, and endpoints the push service has dropped (404/410)
   * are deleted so they aren't retried forever.
   */
  async sendToUser(userId: string, payload: PushPayload): Promise<void> {
    if (!this.isEnabled) {
      return;
    }

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
    });
    if (subscriptions.length === 0) {
      return;
    }

    const body = JSON.stringify(payload);
    const staleIds: string[] = [];

    await Promise.all(
      subscriptions.map(async (subscription) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: subscription.endpoint,
              keys: { p256dh: subscription.p256dh, auth: subscription.auth },
            },
            body,
          );
        } catch (error) {
          if (error instanceof WebPushError && (error.statusCode === 404 || error.statusCode === 410)) {
            staleIds.push(subscription.id);
            return;
          }
          this.logger.warn(
            `Push failed for user ${userId}: ${error instanceof Error ? error.message : String(error)}`,
          );
        }
      }),
    );

    if (staleIds.length > 0) {
      await this.prisma.pushSubscription.deleteMany({ where: { id: { in: staleIds } } });
      this.logger.log(`Removed ${staleIds.length} expired push subscription(s)`);
    }
  }
}
