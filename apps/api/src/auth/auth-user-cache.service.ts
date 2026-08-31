import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from './jwt.strategy';

/**
 * How long a resolved principal is trusted without asking the database again.
 * Deactivating or deleting an account invalidates its entry immediately, so the
 * window only applies to changes made straight in the database — or, if the API
 * ever runs on more than one replica, on the replicas that did not serve the
 * change.
 */
const TTL_MS = 30_000;

/** Above this, expired entries are swept before inserting a new one. */
const SWEEP_THRESHOLD = 500;

type CacheEntry = {
  /** null = the account exists but may not authenticate (inactive/missing). */
  user: AuthenticatedUser | null;
  expiresAt: number;
};

/**
 * Remembers the `id + role` lookup the JWT guard does on every request.
 *
 * Without it each API call pays an extra database round trip before any of its
 * own work — the single most repeated query in the app.
 */
@Injectable()
export class AuthUserCache {
  private readonly entries = new Map<string, CacheEntry>();

  /** `undefined` = nothing cached; `null` = cached rejection. */
  get(userId: string, now = Date.now()): AuthenticatedUser | null | undefined {
    const entry = this.entries.get(userId);
    if (!entry) {
      return undefined;
    }
    if (entry.expiresAt <= now) {
      this.entries.delete(userId);
      return undefined;
    }
    return entry.user;
  }

  set(userId: string, user: AuthenticatedUser | null, now = Date.now()): void {
    if (this.entries.size >= SWEEP_THRESHOLD) {
      this.sweepExpired(now);
    }
    this.entries.set(userId, { user, expiresAt: now + TTL_MS });
  }

  /** Call after anything that changes whether or how a user may authenticate. */
  invalidate(userId: string): void {
    this.entries.delete(userId);
  }

  clear(): void {
    this.entries.clear();
  }

  private sweepExpired(now: number): void {
    for (const [userId, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(userId);
      }
    }
  }
}
