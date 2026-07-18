import type {
  Transport,
  EmailMessage,
  SendResult,
} from "../types.js";
import { createSendError } from "../transport.js";
import { encodeBase64Lines } from "../utils.js";

export interface HttpProviderOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export interface HttpProviderConfig {
  id: string;
  baseUrl: string;
  buildHeaders: (apiKey: string) => Record<string, string>;
  buildBody: (message: EmailMessage) => Record<string, unknown>;
  parseResponse: (body: unknown) => { messageId: string };
  parseError: (status: number, body: unknown) => { message: string; code: string };
}

export function toAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
}

export function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export async function collectStream(
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

export async function attachmentToBase64(
  att: NonNullable<EmailMessage["attachments"]>[number],
): Promise<{ filename: string; content: string; content_type?: string; content_id?: string }> {
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

  return {
    filename: att.filename,
    content,
    content_type: att.contentType,
    content_id: att.cid,
  };
}

export function createHttpTransport(
  config: HttpProviderConfig,
  options: HttpProviderOptions,
): Transport {
  const { apiKey, baseUrl, timeout } = {
    baseUrl: config.baseUrl,
    timeout: 30_000,
    ...options,
  };

  const url = `${baseUrl}${config.id === "resend" ? "/emails" : ""}`;

  return {
    id: config.id,

    async send(message: EmailMessage): Promise<SendResult> {
      const headers = config.buildHeaders(apiKey);
      const body = config.buildBody(message);

      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { ...headers, "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        const responseBody = await response.json().catch(() => ({}));

        if (!response.ok) {
          const { message: errMsg, code } = config.parseError(response.status, responseBody);
          throw createSendError(errMsg, config.id, {
            code,
            statusCode: response.status,
            retryable: response.status === 429 || response.status >= 500,
          });
        }

        const { messageId } = config.parseResponse(responseBody);

        return {
          messageId,
          transportId: config.id,
          timestamp: new Date(),
        };
      } catch (err) {
        if (err instanceof Error && "code" in err) throw err;

        const error =
          err instanceof DOMException && err.name === "AbortError"
            ? createSendError(`${config.id} request timed out`, config.id, {
                code: "TIMEOUT",
                retryable: true,
              })
            : createSendError(
                err instanceof Error ? err.message : String(err),
                config.id,
                { code: "NETWORK_ERROR", retryable: true },
              );

        throw error;
      } finally {
        clearTimeout(timer);
      }
    },
  };
}
