import type { Transport, EmailMessage, SendResult } from "../../types.js";
import { createSendError } from "../../transport.js";

export interface SesTransportOptions {
  accessKeyId: string;
  secretAccessKey: string;
  region?: string;
  sessionToken?: string;
  baseUrl?: string;
  timeout?: number;
  configurationSet?: string;
  tags?: Record<string, string>;
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

function toAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
}

function toSimpleAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return addr.address;
}

async function sha256(data: ArrayBuffer): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(hash);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256(
  key: ArrayBuffer,
  data: string,
): Promise<ArrayBuffer> {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    key,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(data));
}

function toAmzDate(date: Date): string {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

function toShortDate(date: Date): string {
  return toAmzDate(date).slice(0, 8);
}

async function signRequest(
  method: string,
  url: string,
  headers: Record<string, string>,
  payload: string,
  credentials: {
    accessKeyId: string;
    secretAccessKey: string;
    region: string;
    sessionToken?: string;
  },
  date: Date,
): Promise<Record<string, string>> {
  const host = new URL(url).host;
  const amzDate = toAmzDate(date);
  const shortDate = toShortDate(date);
  const service = "ses";

  const signedHeaders = [
    "content-type",
    "host",
    "x-amz-date",
    ...(credentials.sessionToken ? ["x-amz-security-token"] : []),
  ].sort();

  const payloadHash = await sha256(new TextEncoder().encode(payload).buffer);

  const canonicalHeaders = signedHeaders
    .map((h) => {
      if (h === "content-type") return `content-type:${headers["Content-Type"] ?? "application/json"}`;
      if (h === "host") return `host:${host}`;
      if (h === "x-amz-date") return `x-amz-date:${amzDate}`;
      if (h === "x-amz-security-token") return `x-amz-security-token:${credentials.sessionToken}`;
      return `${h}:${headers[h] ?? ""}`;
    })
    .join("\n");

  const canonicalRequest = [
    method,
    new URL(url).pathname,
    new URL(url).search?.slice(1) ?? "",
    `${canonicalHeaders}\n`,
    signedHeaders.join(";"),
    payloadHash,
  ].join("\n");

  const canonicalRequestHash = await sha256(
    new TextEncoder().encode(canonicalRequest).buffer,
  );

  const credentialScope = `${shortDate}/${credentials.region}/${service}/aws4_request`;
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    credentialScope,
    canonicalRequestHash,
  ].join("\n");

  const kDate = await hmacSha256(
    new TextEncoder().encode(`AWS4${credentials.secretAccessKey}`).buffer,
    shortDate,
  );
  const kRegion = await hmacSha256(kDate, credentials.region);
  const kService = await hmacSha256(kRegion, service);
  const kSigning = await hmacSha256(kService, "aws4_request");

  const signatureBytes = await hmacSha256(kSigning, stringToSign);
  const signature = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const authHeader = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders.join(";")}, Signature=${signature}`;

  const result: Record<string, string> = {
    "Content-Type": headers["Content-Type"] ?? "application/json",
    Host: host,
    "X-Amz-Date": amzDate,
    Authorization: authHeader,
  };

  if (credentials.sessionToken) {
    result["X-Amz-Security-Token"] = credentials.sessionToken;
  }

  return result;
}

export class SesTransport implements Transport {
  readonly id = "ses";
  private options: SesTransportOptions;
  private region: string;

  constructor(options: SesTransportOptions) {
    this.options = options;
    this.region = options.region ?? "us-east-1";
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const toAddresses = toArray(message.to).map(toSimpleAddress);
    const ccAddresses = message.cc
      ? toArray(message.cc).map(toSimpleAddress)
      : undefined;
    const bccAddresses = message.bcc
      ? toArray(message.bcc).map(toSimpleAddress)
      : undefined;

    const destination: Record<string, string[]> = { ToAddresses: toAddresses };
    if (ccAddresses?.length) destination.CcAddresses = ccAddresses;
    if (bccAddresses?.length) destination.BccAddresses = bccAddresses;

    const content: Record<string, unknown> = {};
    if (message.html) {
      content.Html = { Data: message.html, Charset: "UTF-8" };
    }
    if (message.text) {
      content.Text = { Data: message.text, Charset: "UTF-8" };
    }

    const sesMessage: Record<string, unknown> = {
      Subject: { Data: message.subject, Charset: "UTF-8" },
      Body: content,
    };

    if (message.headers) {
      sesMessage.Headers = Object.entries(message.headers).map(
        ([Name, Value]) => ({ Name, Value }),
      );
    }

    const simpleContent = {
      ...sesMessage,
      FromEmailAddress: toAddress(message.from),
      Destination: destination,
    };

    const payload: Record<string, unknown> = {
      Content: {
        Simple: simpleContent,
      },
    };

    const simple = payload.Content as { Simple: Record<string, unknown> };

    if (this.options.configurationSet) {
      simple.Simple.ConfigurationSetName = this.options.configurationSet;
    }

    if (this.options.tags) {
      simple.Simple.EmailTags = Object.entries(this.options.tags).map(
        ([Name, Value]) => ({ Name, Value }),
      );
    }

    const payloadStr = JSON.stringify(payload);
    const baseUrl =
      this.options.baseUrl ??
      `https://email.${this.region}.amazonaws.com/v2/email/outbound-emails`;

    const date = new Date();
    const signedHeaders = await signRequest(
      "POST",
      baseUrl,
      { "Content-Type": "application/json" },
      payloadStr,
      {
        accessKeyId: this.options.accessKeyId,
        secretAccessKey: this.options.secretAccessKey,
        region: this.region,
        sessionToken: this.options.sessionToken,
      },
      date,
    );

    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      this.options.timeout ?? 30_000,
    );

    try {
      const response = await fetch(baseUrl, {
        method: "POST",
        headers: signedHeaders,
        body: payloadStr,
        signal: controller.signal,
      });

      const body = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorBody = body as {
          Message?: string;
          Code?: string;
        };
        throw createSendError(
          errorBody.Message ?? `SES API error: ${response.status}`,
          this.id,
          {
            code: errorBody.Code ?? "SES_API_ERROR",
            statusCode: response.status,
            retryable:
              response.status === 429 ||
              response.status >= 500 ||
              errorBody.Code === "Throttling",
          },
        );
      }

      const result = body as { MessageId: string };

      return {
        messageId: result.MessageId,
        transportId: this.id,
        timestamp: new Date(),
      };
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;

      const error =
        err instanceof DOMException && err.name === "AbortError"
          ? createSendError("SES request timed out", this.id, {
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
