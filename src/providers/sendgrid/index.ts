import type { Transport, EmailMessage, SendResult } from "../../types.js";
import { createSendError } from "../../transport.js";
import { encodeBase64Lines } from "../../utils.js";

export interface SendGridTransportOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
  sandboxMode?: boolean;
}

function toSendGridAddress(
  addr: string | { name: string; address: string },
): { email: string; name?: string } {
  if (typeof addr === "string") return { email: addr };
  return { email: addr.address, name: addr.name };
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

async function collectStream(
  stream: ReadableStream<Uint8Array>,
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) chunks.push(value);
  }
  const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const c of chunks) {
    result.set(c, offset);
    offset += c.length;
  }
  return result;
}

export class SendGridTransport implements Transport {
  readonly id = "sendgrid";
  private apiKey: string;
  private baseUrl: string;
  private timeout: number;
  private sandboxMode: boolean;

  constructor(options: SendGridTransportOptions) {
    this.apiKey = options.apiKey;
    this.baseUrl = options.baseUrl ?? "https://api.sendgrid.com";
    this.timeout = options.timeout ?? 30000;
    this.sandboxMode = options.sandboxMode ?? false;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const personalizations: Record<string, unknown>[] = [
      {
        to: toArray(message.to).map(toSendGridAddress),
      },
    ];

    if (message.cc) {
      personalizations[0]!.cc = toArray(message.cc).map(toSendGridAddress);
    }
    if (message.bcc) {
      personalizations[0]!.bcc = toArray(message.bcc).map(toSendGridAddress);
    }
    if (message.replyTo) {
      personalizations[0]!.reply_to = toSendGridAddress(message.replyTo);
    }
    if (message.headers) {
      personalizations[0]!.headers = message.headers;
    }

    const payload: Record<string, unknown> = {
      personalizations,
      from: toSendGridAddress(message.from),
      subject: message.subject,
    };

    const content: { type: string; value: string }[] = [];
    if (message.text) {
      content.push({ type: "text/plain", value: message.text });
    }
    if (message.html) {
      content.push({ type: "text/html", value: message.html });
    }
    if (content.length > 0) {
      payload.content = content;
    }

    if (message.attachments?.length) {
      payload.attachments = await Promise.all(
        message.attachments.map(async (att) => {
          let content: string;

          if (att.content instanceof Uint8Array) {
            content = encodeBase64Lines(att.content);
          } else if (att.content instanceof ReadableStream) {
            const bytes = await collectStream(att.content);
            content = encodeBase64Lines(bytes);
          } else if (typeof att.content === "string") {
            content = att.content;
          } else {
            content = "";
          }

          const attPayload: Record<string, unknown> = {
            content,
            filename: att.filename,
          };
          if (att.contentType) attPayload.type = att.contentType;
          if (att.cid) attPayload.disposition = "inline";

          return attPayload;
        }),
      );
    }

    if (this.sandboxMode) {
      payload.mail_settings = { sandbox_mode: { enable: true } };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/v3/mail/send`, {
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
        const errorBody = body as {
          errors?: { message: string; field?: string; help?: unknown }[];
          message?: string;
        };
        const errMsg =
          errorBody.errors?.[0]?.message ??
          errorBody.message ??
          `SendGrid API error: ${response.status}`;
        throw createSendError(errMsg, this.id, {
          code: "SENDGRID_API_ERROR",
          statusCode: response.status,
          retryable: response.status === 429 || response.status >= 500,
        });
      }

      const messageId =
        response.headers.get("x-message-id") ?? `sg-${Date.now()}`;

      return {
        messageId,
        transportId: this.id,
        timestamp: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;

      const error =
        err instanceof DOMException && err.name === "AbortError"
          ? createSendError("SendGrid request timed out", this.id, {
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
