export type WebhookProvider =
  | "resend"
  | "sendgrid"
  | "postmark"
  | "mailgun";

export interface WebhookVerificationResult {
  valid: boolean;
  provider: WebhookProvider;
  error?: string;
}

export interface WebhookEvent {
  type: string;
  messageId?: string;
  timestamp: Date;
  data?: Record<string, unknown>;
}

async function hmacVerify(
  secret: string,
  payload: string,
  signature: string,
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureBytes = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(payload),
  );

  const expected = Array.from(new Uint8Array(signatureBytes))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  return timingSafeEqual(expected, signature.toLowerCase());
}

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

export async function verifyWebhook(
  provider: WebhookProvider,
  secret: string,
  headers: Record<string, string>,
  body: string,
): Promise<WebhookVerificationResult> {
  try {
    switch (provider) {
      case "resend":
        return await verifyResend(secret, headers, body);
      case "sendgrid":
        return await verifySendGrid(secret, headers, body);
      case "postmark":
        return await verifyPostmark(secret, headers, body);
      case "mailgun":
        return await verifyMailgun(secret, headers, body);
      default:
        return { valid: false, provider: provider as WebhookProvider, error: "Unknown provider" };
    }
  } catch (err) {
    return {
      valid: false,
      provider,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

async function verifyResend(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Promise<WebhookVerificationResult> {
  const signature = headers["svix-signature"];
  const msgId = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];

  if (!signature || !msgId || !timestamp) {
    return { valid: false, provider: "resend", error: "Missing svix headers" };
  }

  const toSign = `${msgId}.${timestamp}.${body}`;
  const parts = signature.split(" ");
  const sig = parts[1]?.split(",")[0] ?? "";

  const valid = await hmacVerify(secret, toSign, sig);

  return { valid, provider: "resend" };
}

async function verifySendGrid(
  secret: string,
  _headers: Record<string, string>,
  body: string,
): Promise<WebhookVerificationResult> {
  const valid = await hmacVerify(secret, body, _headers["x-twilio-signature"] ?? _headers["authorization"] ?? "");

  return { valid, provider: "sendgrid" };
}

async function verifyPostmark(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Promise<WebhookVerificationResult> {
  const signature = headers["x-pm-signature"];
  if (!signature) {
    return { valid: false, provider: "postmark", error: "Missing x-pm-signature header" };
  }

  const valid = await hmacVerify(secret, body, signature);
  return { valid, provider: "postmark" };
}

async function verifyMailgun(
  secret: string,
  headers: Record<string, string>,
  body: string,
): Promise<WebhookVerificationResult> {
  const timestamp = headers["x-mailgun-timestamp"];
  const token = headers["x-mailgun-token"];
  const signature = headers["x-mailgun-signature"];

  if (!timestamp || !token || !signature) {
    return { valid: false, provider: "mailgun", error: "Missing mailgun webhook headers" };
  }

  const bodyJson = JSON.parse(body) as Record<string, unknown>;
  const eventData = bodyJson["event-data"] as Record<string, unknown> | undefined;
  const apiTimestamp = eventData?.timestamp ?? timestamp;

  const toSign = `${apiTimestamp}${token}${secret}`;
  const valid = await hmacVerify(secret, toSign, signature);

  const fiveMinutesAgo = Math.floor(Date.now() / 1000) - 300;
  const ts = typeof apiTimestamp === "number" ? apiTimestamp : parseFloat(String(apiTimestamp));
  if (ts < fiveMinutesAgo) {
    return { valid: false, provider: "mailgun", error: "Timestamp too old" };
  }

  return { valid, provider: "mailgun" };
}

export function parseWebhookEvent(
  provider: WebhookProvider,
  body: string,
): WebhookEvent {
  const data = JSON.parse(body) as Record<string, unknown>;

  switch (provider) {
    case "resend":
      return {
        type: (data.type as string) ?? "unknown",
        messageId: (data.data as Record<string, unknown>)?.email_id as string | undefined,
        timestamp: new Date(),
        data: data.data as Record<string, unknown>,
      };

    case "sendgrid": {
      const events = Array.isArray(data) ? data : [data];
      const first = events[0] as Record<string, unknown> | undefined;
      return {
        type: (first?.event as string) ?? "unknown",
        messageId: first?.smtpid as string | undefined,
        timestamp: first?.timestamp
          ? new Date((first.timestamp as number) * 1000)
          : new Date(),
        data: first as Record<string, unknown>,
      };
    }

    case "postmark":
      return {
        type: (data.RecordType as string) ?? "unknown",
        messageId: (data.MessageID as string) ?? undefined,
        timestamp: data.ReceivedAt
          ? new Date(data.ReceivedAt as string)
          : new Date(),
        data: data as Record<string, unknown>,
      };

    case "mailgun": {
      const eventData = data["event-data"] as Record<string, unknown>;
      const msgHeaders = (eventData?.message as Record<string, unknown>)
        ?.headers as Record<string, unknown> | undefined;
      return {
        type: (eventData?.event as string) ?? "unknown",
        messageId: msgHeaders?.["message-id"] as string | undefined,
        timestamp: eventData?.timestamp
          ? new Date((eventData.timestamp as number) * 1000)
          : new Date(),
        data: eventData as Record<string, unknown>,
      };
    }

    default:
      return {
        type: "unknown",
        timestamp: new Date(),
        data,
      };
  }
}
