import type { Transport, EmailMessage, SendResult } from "./types.js";
import { Mailer, type MailerOptions } from "./transport.js";
import { FailoverMailer } from "./failover.js";
import { withRetry } from "./retry.js";
import { withRateLimiter, type RateLimiterOptions } from "./middleware/rate-limiter.js";
import { MailQueue, type QueueOptions } from "./middleware/queue.js";
import { CircuitBreaker, type CircuitBreakerOptions } from "./middleware/circuit-breaker.js";
import { MetricsCollector } from "./middleware/metrics.js";

export interface ProviderEntry {
  transport: Transport;
  priority?: number;
}

export interface MailerConfig extends MailerOptions {
  providers: Transport[];
  retry?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } | false;
  failover?: boolean;
  rateLimit?: RateLimiterOptions;
  queue?: QueueOptions;
  circuitBreaker?: CircuitBreakerOptions;
  metrics?: boolean;
}

export interface MailerInstance {
  send(message: EmailMessage): Promise<SendResult>;
  transport: Transport;
  destroy?(): Promise<void>;
  metrics?: MetricsCollector;
  queue?: MailQueue;
  circuitBreaker?: CircuitBreaker;
}

export function createMailer(config: MailerConfig): MailerInstance {
  if (config.providers.length === 0) {
    throw new Error("createMailer requires at least one provider");
  }

  let transport: Transport;

  if (config.providers.length === 1 && !config.failover) {
    transport = config.providers[0]!;
  } else {
    const sorted = [...config.providers].sort(
      (a, b) => (a.id.length - b.id.length),
    );
    transport = new FailoverMailer(sorted);
  }

  if (config.retry !== false) {
    const retryOpts =
      !config.retry || typeof config.retry !== "object"
        ? {}
        : config.retry;
    transport = withRetry(transport, retryOpts);
  }

  let metrics: MetricsCollector | undefined;
  let queue: MailQueue | undefined;
  let circuitBreaker: CircuitBreaker | undefined;

  if (config.metrics) {
    metrics = new MetricsCollector(transport);
    transport = metrics;
  }

  if (config.circuitBreaker) {
    circuitBreaker = new CircuitBreaker(transport, config.circuitBreaker);
    transport = circuitBreaker;
  }

  if (config.rateLimit) {
    transport = withRateLimiter(transport, config.rateLimit);
  }

  if (config.queue) {
    queue = new MailQueue(transport, config.queue);
    transport = queue;
  }

  const mailerOpts: MailerOptions = {
    dryRun: config.dryRun,
    inlineCss: config.inlineCss,
    onSend: config.onSend,
    onError: config.onError,
  };

  const mailer = new Mailer(transport, mailerOpts);

  const instance: MailerInstance = {
    send: (message: EmailMessage) => mailer.send(message),
    transport,
  };

  if (metrics) instance.metrics = metrics;
  if (queue) instance.queue = queue;
  if (circuitBreaker) instance.circuitBreaker = circuitBreaker;

  return instance;
}

export function sortProviders(
  providers: Transport[],
  priorities?: Record<string, number>,
): Transport[] {
  if (!priorities) return providers;
  return [...providers].sort((a, b) => {
    const pa = priorities[a.id] ?? 0;
    const pb = priorities[b.id] ?? 0;
    return pa - pb;
  });
}
