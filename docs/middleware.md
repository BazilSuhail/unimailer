# Middleware

All middleware implement the `Transport` interface and can be composed together.

## Retry

Retries failed sends with exponential backoff and jitter.

```typescript
import { withRetry } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const transport = withRetry(
  new ResendTransport({ apiKey: "re_..." }),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryOn: (error) => error.retryable,
  }
);
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `initialDelay` | `number` | `1000` | Initial delay (ms) |
| `maxDelay` | `number` | `30000` | Maximum delay (ms) |
| `backoffMultiplier` | `number` | `2` | Exponential backoff multiplier |
| `retryOn` | `(error) => boolean` | — | Custom retry condition |

### Auto-Retryable Errors

- 429 (rate limit)
- 408 (timeout)
- 503 (service unavailable)
- 504 (gateway timeout)
- Any error with `retryable: true`

---

## Rate Limiter

Token bucket rate limiting per transport.

```typescript
import { withRateLimiter } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const transport = withRateLimiter(
  new ResendTransport({ apiKey: "re_..." }),
  {
    maxPerSecond: 10,
    maxPerMinute: 300,
  }
);
```

### Options

| Option | Type | Description |
|--------|------|-------------|
| `maxPerSecond` | `number` | Maximum sends per second |
| `maxPerMinute` | `number` | Maximum sends per minute (optional) |

---

## Queue

Concurrency-limited queue with backpressure.

```typescript
import { MailQueue } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const queue = new MailQueue(
  new ResendTransport({ apiKey: "re_..." }),
  {
    concurrency: 5,
    maxSize: 1000,
  }
);

await queue.send(message);
console.log(queue.size);   // Pending items
console.log(queue.active); // In-flight sends

await queue.close(); // Wait for all pending to complete
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | — | Max simultaneous sends |
| `maxSize` | `number` | `1000` | Max queue size (pending + in-flight) |

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `size` | `number` | Items waiting in queue |
| `active` | `number` | Currently in-flight sends |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `close()` | `Promise<void>` | Drain queue and wait for completion |

---

## Circuit Breaker

Auto-disables a transport after repeated failures, auto-recovers after timeout.

```typescript
import { CircuitBreaker } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const breaker = new CircuitBreaker(
  new ResendTransport({ apiKey: "re_..." }),
  {
    failureThreshold: 5,
    halfOpenAfter: 30000,
  }
);

console.log(breaker.getState()); // "closed" | "open" | "half-open"
breaker.reset(); // Manually close the circuit
```

### States

| State | Behavior |
|-------|----------|
| `closed` | Normal operation. Failures are counted. |
| `open` | All sends rejected immediately with `CIRCUIT_OPEN` error. |
| `half-open` | After `halfOpenAfter` ms, allows test sends. 2 successes = close. |

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | `number` | — | Failures before opening circuit |
| `halfOpenAfter` | `number` | `5000` | Ms before trying half-open |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `getState()` | `CircuitState` | Current circuit state |
| `reset()` | `void` | Manually close the circuit |
| `failures` | `number` | Current failure count |

---

## Metrics

Tracks send counts, failures, latencies, and errors per transport.

```typescript
import { MetricsCollector } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const metrics = new MetricsCollector(
  new ResendTransport({ apiKey: "re_..." })
);

await metrics.send(message);
await metrics.send(message);

const snapshot = metrics.snapshot();
console.log(snapshot.total);      // 2
console.log(snapshot.success);    // 2
console.log(snapshot.failure);    // 0
console.log(snapshot.latencies);  // [45, 38]
console.log(snapshot.byTransport);

metrics.reset(); // Clear all data
```

### Snapshot Format

```typescript
{
  total: number;
  success: number;
  failure: number;
  latencies: number[];
  errors: Array<{
    transportId: string;
    code: string;
    timestamp: number;
  }>;
  byTransport: Record<string, {
    success: number;
    failure: number;
    avgLatency: number;
  }>;
}
```

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `snapshot()` | `MetricsSnapshot` | Current metrics data |
| `reset()` | `void` | Clear all collected data |
