import type {
  Transport,
  EmailMessage,
  SendResult,
} from "../../types.js";
import { createSendError } from "../../transport.js";
import { encodeBase64Lines } from "../../utils.js";

export interface ResendTransportOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

interface ResendPayload {
  from: string;
  to: string[];
  cc?: string[];
  bcc?: string[];
  reply_to?: string[];
  subject: string;
  html?: string;
  text?: string;
  headers?: Record<string, string>;
  attachments?: {
    filename: string;
    content: string;
    content_type?: string;
    content_id?: string;
  }[];
}

function toResendAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export class ResendTransport implements Transport {
  readonly id = "resend";
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;

  constructor(options: ResendTransportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.resend.com";
    this.timeout = options.timeout ?? 30000;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const payload: ResendPayload = {
      from: toResendAddress(message.from),
      to: toArray(message.to).map(toResendAddress),
      subject: message.subject,
    };

    if (message.cc) payload.cc = toArray(message.cc).map(toResendAddress);
    if (message.bcc) payload.bcc = toArray(message.bcc).map(toResendAddress);
    if (message.replyTo) {
      payload.reply_to = [toResendAddress(message.replyTo)];
    }
    if (message.html) payload.html = message.html;
    if (message.text) payload.text = message.text;
    if (message.headers) payload.headers = message.headers;

    if (message.attachments?.length) {
      payload.attachments = await Promise.all(
        message.attachments.map(async (att) => {
          let content: string;

          if (att.content instanceof Uint8Array) {
            content = encodeBase64Lines(att.content);
          } else if (att.content instanceof ReadableStream) {
            const reader = att.content.getReader();
            const chunks: Uint8Array[] = [];
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) chunks.push(value);
            }
            const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
            const bytes = new Uint8Array(totalLength);
            let offset = 0;
            for (const c of chunks) {
              bytes.set(c, offset);
              offset += c.length;
            }
            content = encodeBase64Lines(bytes);
          } else if (typeof att.content === "string") {
            content = att.content;
          } else {
            content = "";
          }

          return {
            filename: att.filename,
            content,
            content_type: att.contentType,
            content_id: att.cid,
          };
        }),
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/emails`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const errorBody = body as { message?: string; name?: string };
        throw createSendError(
          errorBody.message ?? `Resend API error: ${response.status}`,
          this.id,
          {
            code: errorBody.name ?? "RESEND_API_ERROR",
            statusCode: response.status,
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const result = (await response.json()) as { id: string };

      return {
        messageId: result.id,
        transportId: this.id,
        timestamp: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;

      const error =
        err instanceof DOMException && err.name === "AbortError"
          ? createSendError("Resend request timed out", this.id, {
              code: "TIMEOUT",
              retryable: true,
            })
          : createSendError(
              err instanceof Error ? err.message : String(err),
              this.id,
              { code: "NETWORK_ERROR", retryable: true },
            );

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
