import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';
import type { NotificationDto } from '@fabxpert/shared/dto/notification.dto';
import type { TaskStreamEvent } from '@fabxpert/shared/dto/task.dto';

/** Half the idle timeout of the tightest proxy in front of the API. */
const HEARTBEAT_MS = 30_000;

type Delivery = {
  /** Null reaches every open stream. */
  userId: string | null;
  event: TaskStreamEvent;
};

/** Live task events for the admins' open apps: list changes and notifications. */
@Injectable()
export class TaskEventsService {
  private readonly emitter = new EventEmitter();

  constructor() {
    // One listener per open admin tab; the default cap of 10 would warn.
    this.emitter.setMaxListeners(0);
  }

  /** Tells every open app that the task lists moved. */
  emitChanged(): void {
    this.emitter.emit('task', {
      userId: null,
      event: { type: 'tasks-changed' },
    } satisfies Delivery);
  }

  /** Hands a notification to its recipient's open apps only. */
  emitNotification(userId: string, notification: NotificationDto): void {
    this.emitter.emit('task', {
      userId,
      event: { type: 'notification', notification },
    } satisfies Delivery);
  }

  subscribe(userId: string): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const handler = (delivery: Delivery) => {
        if (delivery.userId === null || delivery.userId === userId) {
          subscriber.next({ data: delivery.event });
        }
      };

      this.emitter.on('task', handler);

      // Keeps proxies from closing a quiet stream, and lets the app tell a
      // dead connection from one with nothing to say.
      const heartbeat = setInterval(() => {
        subscriber.next({ data: { type: 'heartbeat' } satisfies TaskStreamEvent });
      }, HEARTBEAT_MS);

      return () => {
        this.emitter.off('task', handler);
        clearInterval(heartbeat);
      };
    });
  }
}
