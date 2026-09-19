import type { EnvelopeLog, PublicReadRateLimiter, RateLimitResult } from '../../ports/chain-view';
import { PublicReadLimitPerMinute } from '../../domain/constants';

type Counter = { n: number; resetAt: number };

export class MemoryRateAdapters implements PublicReadRateLimiter, EnvelopeLog {
  private readonly counters = new Map<string, Counter>();
  private readonly envelopes = new Set<string>();

  async hitPublicRead(ip: string): Promise<RateLimitResult> {
    const windowMs = 60_000;
    const now = Date.now();
    const key = `pub:${ip}`;
    const cur = this.counters.get(key);
    if (!cur || now >= cur.resetAt) {
      this.counters.set(key, { n: 1, resetAt: now + windowMs });
      return { allowed: true, retryAfterSeconds: 60 };
    }
    if (cur.n >= PublicReadLimitPerMinute) {
      return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
    }
    cur.n += 1;
    return { allowed: true, retryAfterSeconds: Math.max(1, Math.ceil((cur.resetAt - now) / 1000)) };
  }

  async seen(hashHex: string): Promise<boolean> {
    return this.envelopes.has(hashHex);
  }

  async remember(hashHex: string): Promise<void> {
    this.envelopes.add(hashHex);
  }
}
