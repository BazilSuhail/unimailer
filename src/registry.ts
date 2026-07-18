import type { Transport, EmailMessage, SendResult } from "./types.js";
import { Mailer } from "./transport.js";
import { FailoverMailer } from "./failover.js";
import { withRetry } from "./retry.js";

export interface ProviderEntry {
  transport: Transport;
  priority?: number;
}

export interface MailerConfig {
  providers: Transport[];
  retry?: {
    maxRetries?: number;
    initialDelay?: number;
    maxDelay?: number;
    backoffMultiplier?: number;
  } | false;
  failover?: boolean;
}

export interface MailerInstance {
  send(message: EmailMessage): Promise<SendResult>;
  transport: Transport;
  destroy?(): Promise<void>;
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

  const mailer = new Mailer(transport);

  return {
    send: (message: EmailMessage) => mailer.send(message),
    transport,
  };
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
