import type { Transport, SendError } from "./types.js";

export interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOn?: (error: SendError) => boolean;
}

const DEFAULT_RETRY_OPTIONS: RetryOptions = {
  maxRetries: 3,
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
};

function isRetryable(error: SendError): boolean {
  if (error.retryable) return true;
  if (!error.statusCode) return true;
  const code = error.statusCode;
  return code === 429 || code === 408 || code === 503 || code === 504;
}

function calculateDelay(
  attempt: number,
  options: RetryOptions,
): number {
  const exponential =
    options.initialDelay * Math.pow(options.backoffMultiplier, attempt);
  const jitter = Math.random() * 0.3 * exponential;
  return Math.min(exponential + jitter, options.maxDelay);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withRetry(
  transport: Transport,
  options?: Partial<RetryOptions>,
): Transport {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };

  return {
    id: `${transport.id}(retry)`,

    async send(message) {
      let lastError: SendError | undefined;

      for (let attempt = 0; attempt <= opts.maxRetries; attempt++) {
        try {
          return await transport.send(message);
        } catch (err) {
          const sendError =
            err instanceof Error && "code" in err
              ? (err as SendError)
              : (new Error(String(err)) as SendError);

          lastError = sendError;

          const shouldRetry =
            attempt < opts.maxRetries &&
            (opts.retryOn
              ? opts.retryOn(sendError)
              : isRetryable(sendError));

          if (!shouldRetry) throw sendError;

          const delay = calculateDelay(attempt, opts);
          await sleep(delay);
        }
      }

      throw lastError;
    },
  };
}
