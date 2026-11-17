import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/**
 * Slows password guessing. Failed sign-ins are counted per email and per client address over a
 * rolling window; past the limit, sign-in answers 429 until the window passes. A success clears
 * the email's count. In-process: move to Redis when the API runs on more than one instance.
 */

export const LOGIN_WINDOW_MS = 15 * 60 * 1000;
export const MAX_FAILURES_PER_EMAIL = 5;
export const MAX_FAILURES_PER_ADDRESS = 50;

interface Bucket {
  failures: number[];
}

@Injectable()
export class LoginThrottle {
  private readonly buckets = new Map<string, Bucket>();

  private now(): number {
    return Date.now();
  }

  /** Throws 429 when this email or address has failed too often recently. */
  assertAllowed(email: string, address: string): void {
    const waitMs = Math.max(
      this.waitFor(`email:${email}`, MAX_FAILURES_PER_EMAIL),
      this.waitFor(`ip:${address}`, MAX_FAILURES_PER_ADDRESS),
    );
    if (waitMs > 0) {
      const minutes = Math.max(1, Math.ceil(waitMs / 60_000));
      throw new HttpException(
        `Too many sign-in attempts. Try again in ${minutes} minute${minutes === 1 ? '' : 's'}.`,
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
  }

  recordFailure(email: string, address: string): void {
    for (const key of [`email:${email}`, `ip:${address}`]) {
      const bucket = this.fresh(key);
      bucket.failures.push(this.now());
      this.buckets.set(key, bucket);
    }
    if (this.buckets.size > 10_000) this.sweep();
  }

  recordSuccess(email: string): void {
    this.buckets.delete(`email:${email}`);
  }

  private waitFor(key: string, limit: number): number {
    const bucket = this.fresh(key);
    if (bucket.failures.length < limit) return 0;
    const oldestCounted = bucket.failures[bucket.failures.length - limit] ?? this.now();
    return oldestCounted + LOGIN_WINDOW_MS - this.now();
  }

  private fresh(key: string): Bucket {
    const cutoff = this.now() - LOGIN_WINDOW_MS;
    const bucket = this.buckets.get(key) ?? { failures: [] };
    bucket.failures = bucket.failures.filter((at) => at > cutoff);
    return bucket;
  }

  private sweep(): void {
    for (const key of [...this.buckets.keys()]) {
      if (this.fresh(key).failures.length === 0) this.buckets.delete(key);
    }
  }
}
