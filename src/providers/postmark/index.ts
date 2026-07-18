import type { Transport, EmailMessage, SendResult } from "../../types.js";
import { createSendError } from "../../transport.js";
import { encodeBase64Lines } from "../../utils.js";

export interface PostmarkTransportOptions {
  serverToken: string;
  baseUrl?: string;
  timeout?: number;
  messageStream?: string;
}

function toPostmarkAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
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

export class PostmarkTransport implements Transport {
  readonly id = "postmark";
  private serverToken: string;
  private baseUrl: string;
  private timeout: number;
  private messageStream: string;

  constructor(options: PostmarkTransportOptions) {
    this.serverToken = options.serverToken;
    this.baseUrl = options.baseUrl ?? "https://api.postmarkapp.com";
    this.timeout = options.timeout ?? 30000;
    this.messageStream = options.messageStream ?? "outbound";
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const payload: Record<string, unknown> = {
      From: toPostmarkAddress(message.from),
      To: toArray(message.to).map(toPostmarkAddress).join(", "),
      Subject: message.subject,
      MessageStream: this.messageStream,
    };

    if (message.cc) {
      payload.Cc = toArray(message.cc).map(toPostmarkAddress).join(", ");
    }
    if (message.bcc) {
      payload.Bcc = toArray(message.bcc).map(toPostmarkAddress).join(", ");
    }
    if (message.replyTo) {
      payload.ReplyTo = toPostmarkAddress(message.replyTo);
    }
    if (message.text) payload.TextBody = message.text;
    if (message.html) payload.HtmlBody = message.html;
    if (message.headers) payload.Headers = message.headers;

    if (message.attachments?.length) {
      payload.Attachments = await Promise.all(
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
            Name: att.filename,
            Content: content,
          };
          if (att.contentType) attPayload.ContentType = att.contentType;
          if (att.cid) attPayload.ContentID = att.cid;

          return attPayload;
        }),
      );
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(`${this.baseUrl}/email`, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "X-Postmark-Server-Token": this.serverToken,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));
      const errorBody = body as {
        ErrorCode?: number;
        Message?: string;
        MessageID?: string;
      };

      if (!response.ok || errorBody.ErrorCode !== 0) {
        throw createSendError(
          errorBody.Message ?? `Postmark API error: ${response.status}`,
          this.id,
          {
            code: "POSTMARK_API_ERROR",
            statusCode: response.status,
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const messageId = errorBody.MessageID ?? `pm-${Date.now()}`;

      return {
        messageId,
        transportId: this.id,
        timestamp: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;

      const error =
        err instanceof DOMException && err.name === "AbortError"
          ? createSendError("Postmark request timed out", this.id, {
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
