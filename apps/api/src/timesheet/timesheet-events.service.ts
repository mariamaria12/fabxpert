import { Injectable, MessageEvent } from '@nestjs/common';
import { EventEmitter } from 'events';
import { Observable } from 'rxjs';

export type TimesheetEventPayload = {
  type: 'created' | 'updated' | 'deleted';
  id: string;
  personName: string;
};

@Injectable()
export class TimesheetEventsService {
  private readonly emitter = new EventEmitter();

  emit(event: TimesheetEventPayload): void {
    this.emitter.emit('timesheet', event);
  }

  subscribe(): Observable<MessageEvent> {
    return new Observable((subscriber) => {
      const handler = (event: TimesheetEventPayload) => {
        subscriber.next({ data: event });
      };

      this.emitter.on('timesheet', handler);
      return () => {
        this.emitter.off('timesheet', handler);
      };
    });
  }
}
