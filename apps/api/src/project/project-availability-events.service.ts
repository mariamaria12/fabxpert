import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';

export type ProjectAvailabilityEventPayload = {
  type: 'available-projects-changed';
};

type ProjectAvailabilityHeartbeatPayload = {
  type: 'heartbeat';
};

const HEARTBEAT_MS = 30_000;

@Injectable()
export class ProjectAvailabilityEventsService {
  private readonly emitter = new EventEmitter();

  emitChanged(): void {
    this.emitter.emit('availability', {
      type: 'available-projects-changed',
    } satisfies ProjectAvailabilityEventPayload);
  }

  subscribe(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const handler = (event: ProjectAvailabilityEventPayload) => {
        subscriber.next({ data: event });
      };

      this.emitter.on('availability', handler);

      const heartbeat = setInterval(() => {
        subscriber.next({
          data: { type: 'heartbeat' } satisfies ProjectAvailabilityHeartbeatPayload,
        });
      }, HEARTBEAT_MS);

      return () => {
        this.emitter.off('availability', handler);
        clearInterval(heartbeat);
      };
    });
  }
}
