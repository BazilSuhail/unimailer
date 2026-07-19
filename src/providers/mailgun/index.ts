import type { Transport, EmailMessage, SendResult } from "../../types.js";
import { createSendError } from "../../transport.js";
import { encodeBase64Lines } from "../../utils.js";

export interface MailgunTransportOptions {
  apiKey: string;
  domain: string;
  baseUrl?: string;
  timeout?: number;
  region?: "us" | "eu";
  webhookSigningKey?: string;
}

function toMailgunAddress(
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

export class MailgunTransport implements Transport {
  readonly id = "mailgun";
  private apiKey: string;
  private domain: string;
  private baseUrl: string;
  private timeout: number;

  constructor(options: MailgunTransportOptions) {
    this.apiKey = options.apiKey;
    this.domain = options.domain;
    this.timeout = options.timeout ?? 30_000;
    this.baseUrl =
      options.baseUrl ??
      (options.region === "eu"
        ? "https://api.eu.mailgun.net/v3"
        : "https://api.mailgun.net/v3");
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const formData = new FormData();

    formData.append("from", toMailgunAddress(message.from));

    const toList = toArray(message.to).map(toMailgunAddress);
    for (const addr of toList) {
      formData.append("to", addr);
    }

    if (message.cc) {
      const ccList = toArray(message.cc).map(toMailgunAddress);
      for (const addr of ccList) {
        formData.append("cc", addr);
      }
    }

    if (message.bcc) {
      const bccList = toArray(message.bcc).map(toMailgunAddress);
      for (const addr of bccList) {
        formData.append("bcc", addr);
      }
    }

    if (message.replyTo) {
      formData.append("h:reply-to", toMailgunAddress(message.replyTo));
    }

    formData.append("subject", message.subject);

    if (message.text) {
      formData.append("text", message.text);
    }
    if (message.html) {
      formData.append("html", message.html);
    }

    if (message.headers) {
      for (const [key, value] of Object.entries(message.headers)) {
        formData.append(`h:${key}`, value);
      }
    }

    if (message.attachments?.length) {
      for (const att of message.attachments) {
        let blob: Blob;

        if (att.content instanceof Uint8Array) {
          const base64 = encodeBase64Lines(att.content);
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], {
            type: att.contentType ?? "application/octet-stream",
          });
        } else if (att.content instanceof ReadableStream) {
          const bytes = await collectStream(att.content);
          blob = new Blob([bytes], {
            type: att.contentType ?? "application/octet-stream",
          });
        } else if (typeof att.content === "string") {
          const binary = atob(att.content);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          blob = new Blob([bytes], {
            type: att.contentType ?? "application/octet-stream",
          });
        } else {
          blob = new Blob([], { type: "application/octet-stream" });
        }

        formData.append("attachment", blob, att.filename);
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(
        `${this.baseUrl}/${this.domain}/messages`,
        {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`api:${this.apiKey}`)}`,
          },
          body: formData,
          signal: controller.signal,
        },
      );

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorBody = body as { message?: string; code?: string };
        throw createSendError(
          errorBody.message ?? `Mailgun API error: ${response.status}`,
          this.id,
          {
            code: errorBody.code ?? "MAILGUN_API_ERROR",
            statusCode: response.status,
            retryable: response.status === 429 || response.status >= 500,
          },
        );
      }

      const result = body as { id: string };

      return {
        messageId: result.id,
        transportId: this.id,
        timestamp: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;

      const error =
        err instanceof DOMException && err.name === "AbortError"
          ? createSendError("Mailgun request timed out", this.id, {
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
