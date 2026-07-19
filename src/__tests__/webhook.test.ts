import { describe, it, expect } from "vitest";
import { verifyWebhook, parseWebhookEvent } from "../webhook.js";

describe("verifyWebhook", () => {
  it("returns error for unknown provider", async () => {
    const result = await verifyWebhook(
      "unknown" as any,
      "secret",
      {},
      "{}",
    );
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Unknown provider");
  });

  it("returns error when resend svix headers missing", async () => {
    const result = await verifyWebhook("resend", "secret", {}, "{}");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing svix headers");
  });

  it("returns error when postmark signature missing", async () => {
    const result = await verifyWebhook("postmark", "secret", {}, "{}");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing x-pm-signature header");
  });

  it("returns error when mailgun headers missing", async () => {
    const result = await verifyWebhook("mailgun", "secret", {}, "{}");
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Missing mailgun webhook headers");
  });
});

describe("parseWebhookEvent", () => {
  it("parses resend event", () => {
    const body = JSON.stringify({
      type: "email.delivered",
      data: { email_id: "re_123" },
    });
    const event = parseWebhookEvent("resend", body);
    expect(event.type).toBe("email.delivered");
    expect(event.messageId).toBe("re_123");
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("parses sendgrid event", () => {
    const body = JSON.stringify([
      { event: "delivered", smtpid: "sg_123", timestamp: 1700000000 },
    ]);
    const event = parseWebhookEvent("sendgrid", body);
    expect(event.type).toBe("delivered");
    expect(event.messageId).toBe("sg_123");
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("parses sendgrid single event", () => {
    const body = JSON.stringify({ event: "bounce", smtpid: "sg_456", timestamp: 1700000000 });
    const event = parseWebhookEvent("sendgrid", body);
    expect(event.type).toBe("bounce");
    expect(event.messageId).toBe("sg_456");
  });

  it("parses postmark event", () => {
    const body = JSON.stringify({
      RecordType: "Delivery",
      MessageID: "pm_789",
      ReceivedAt: "2024-01-01T00:00:00Z",
    });
    const event = parseWebhookEvent("postmark", body);
    expect(event.type).toBe("Delivery");
    expect(event.messageId).toBe("pm_789");
  });

  it("parses mailgun event", () => {
    const body = JSON.stringify({
      "event-data": {
        event: "delivered",
        timestamp: 1700000000,
        message: {
          headers: {
            "message-id": "mg_abc",
          },
        },
      },
    });
    const event = parseWebhookEvent("mailgun", body);
    expect(event.type).toBe("delivered");
    expect(event.messageId).toBe("mg_abc");
    expect(event.timestamp).toBeInstanceOf(Date);
  });

  it("parses unknown event type", () => {
    const event = parseWebhookEvent("resend", "{}");
    expect(event.type).toBe("unknown");
  });
});
