import type { EmailMessage, Transport, SendResult, SendError } from "./types.js";
import { validateMessage } from "./validation.js";

export class Mailer {
  private transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const validated = validateMessage(message);
    return this.transport.send(validated as EmailMessage);
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
