import { Injectable } from '@nestjs/common';
import { filter, map, Observable, Subject, take } from 'rxjs';

/**
 * Ends a user's live event streams the moment their account may no longer sign
 * in. REST calls are refused on the very next request (JwtStrategy), but guards
 * only run when a stream opens, so an open one would stay connected. Once it
 * ends, the client checks its session, gets a 401 and logs out.
 *
 * In memory, like the streams it ends — one API instance.
 */
@Injectable()
export class SessionRevocationService {
  private readonly revocations = new Subject<string>();

  revoke(userId: string): void {
    this.revocations.next(userId);
  }

  /** Emits once, when `userId` is revoked — for `takeUntil` on a stream. */
  revoked(userId: string): Observable<void> {
    return this.revocations.pipe(
      filter((revokedId) => revokedId === userId),
      take(1),
      map(() => undefined),
    );
  }
}
