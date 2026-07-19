import type { EmailMessage, Transport, SendResult, SendError } from "./types.js";
import { validateMessage } from "./validation.js";
import { encodeMessage } from "./mime.js";
import { inlineCss } from "./css-inliner.js";

export interface MailerOptions {
  dryRun?: boolean;
  inlineCss?: boolean;
  onSend?: (message: EmailMessage, result: SendResult) => void | Promise<void>;
  onError?: (message: EmailMessage, error: SendError) => void | Promise<void>;
}

export class Mailer {
  private transport: Transport;
  private options: MailerOptions;

  constructor(transport: Transport, options?: MailerOptions) {
    this.transport = transport;
    this.options = options ?? {};
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const validated = validateMessage(message);

    let msg = validated as EmailMessage;
    if (this.options.inlineCss && msg.html) {
      msg = { ...msg, html: inlineCss(msg.html) };
    }

    if (this.options.dryRun) {
      const rawMime = await encodeMessage(msg);
      return {
        messageId: `dry-run-${Date.now()}`,
        transportId: this.transport.id,
        timestamp: new Date(),
        rawMime,
      };
    }

    try {
      const result = await this.transport.send(msg);
      if (this.options.onSend) {
        await this.options.onSend(msg, result);
      }
      return result;
    } catch (err) {
      if (this.options.onError) {
        await this.options.onError(msg, err as SendError);
      }
      throw err;
    }
  }
}

export function createSendError(
  message: string,
  transportId: string,
  options?: {
    code?: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: Error;
  },
): SendError {
  const error = new Error(message) as SendError;
  error.code = options?.code ?? "SEND_FAILED";
  error.transportId = transportId;
  error.statusCode = options?.statusCode;
  error.retryable = options?.retryable ?? false;
  if (options?.cause) {
    error.cause = options.cause;
  }
  return error;
}
