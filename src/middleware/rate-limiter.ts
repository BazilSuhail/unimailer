import type { Transport, EmailMessage, SendResult } from "../types.js";

export interface RateLimiterOptions {
  maxPerSecond: number;
  maxPerMinute?: number;
}

interface Bucket {
  tokens: number;
  lastRefill: number;
}

export function withRateLimiter(
  transport: Transport,
  options: RateLimiterOptions,
): Transport {
  const buckets = new Map<string, Bucket>();
  const queues = new Map<string, Array<{ resolve: () => void }>>();
  let timer: ReturnType<typeof setTimeout> | undefined;

  function refill(key: string, max: number, intervalMs: number) {
    const bucket = buckets.get(key);
    if (!bucket) return;
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const refillAmount = (elapsed / intervalMs) * max;
    bucket.tokens = Math.min(max, bucket.tokens + refillAmount);
    bucket.lastRefill = now;
  }

  function processQueue(key: string, max: number, intervalMs: number) {
    const q = queues.get(key);
    if (!q || q.length === 0) return;
    refill(key, max, intervalMs);
    while (q.length > 0) {
      const bucket = buckets.get(key);
      if (!bucket || bucket.tokens < 1) break;
      bucket.tokens -= 1;
      q.shift()!.resolve();
    }
  }

  function startTimer() {
    if (timer) return;
    const tick = () => {
      queues.forEach((_q, key) => {
        processQueue(key, options.maxPerSecond, 1000);
        if (options.maxPerMinute) {
          processQueue(`${key}:m`, options.maxPerMinute, 60000);
        }
      });
      if (queues.size > 0) {
        timer = setTimeout(tick, 100);
      } else {
        timer = undefined;
      }
    };
    timer = setTimeout(tick, 100);
  }

  function waitForSlot(key: string, max: number, intervalMs: number): Promise<void> {
    return new Promise((resolve) => {
      if (!buckets.has(key)) {
        buckets.set(key, { tokens: max, lastRefill: Date.now() });
      }
      refill(key, max, intervalMs);
      const bucket = buckets.get(key)!;
      if (bucket.tokens >= 1) {
        bucket.tokens -= 1;
        resolve();
      } else {
        if (!queues.has(key)) queues.set(key, []);
        queues.get(key)!.push({ resolve });
        startTimer();
      }
    });
  }

  return {
    id: `${transport.id}(rate-limited)`,

    async send(message: EmailMessage): Promise<SendResult> {
      await waitForSlot(transport.id, options.maxPerSecond, 1000);
      if (options.maxPerMinute) {
        await waitForSlot(`${transport.id}:m`, options.maxPerMinute, 60000);
      }
      return transport.send(message);
    },
  };
}
