import { describe, it, expect } from "vitest";
import { verifyWebhook, parseWebhookEvent } from "../webhook.js";

describe("verifyWebhook", () => {
  it("returns error for unknown provider", async () => {
    const r = await verifyWebhook("unknown" as any, "s", {}, "{}");
    expect(r.valid).toBe(false);
  });

  it("returns error when resend headers missing", async () => {
    expect((await verifyWebhook("resend", "s", {}, "{}")).error).toContain("svix");
  });

  it("returns error when postmark signature missing", async () => {
    expect((await verifyWebhook("postmark", "s", {}, "{}")).error).toContain("x-pm");
  });

  it("returns error when mailgun headers missing", async () => {
    expect((await verifyWebhook("mailgun", "s", {}, "{}")).error).toContain("mailgun");
  });
});

describe("parseWebhookEvent", () => {
  it("parses resend event", () => {
    const e = parseWebhookEvent("resend", JSON.stringify({
      type: "email.delivered", data: { email_id: "re_123" },
    }));
    expect(e.type).toBe("email.delivered");
    expect(e.messageId).toBe("re_123");
  });

  it("parses sendgrid event", () => {
    const e = parseWebhookEvent("sendgrid", JSON.stringify([
      { event: "delivered", smtpid: "sg_1", timestamp: 1700000000 },
    ]));
    expect(e.type).toBe("delivered");
    expect(e.messageId).toBe("sg_1");
  });

  it("parses postmark event", () => {
    const e = parseWebhookEvent("postmark", JSON.stringify({
      RecordType: "Delivery", MessageID: "pm_1", ReceivedAt: "2024-01-01T00:00:00Z",
    }));
    expect(e.type).toBe("Delivery");
    expect(e.messageId).toBe("pm_1");
  });

  it("parses mailgun event", () => {
    const e = parseWebhookEvent("mailgun", JSON.stringify({
      "event-data": { event: "delivered", timestamp: 1700000000,
        message: { headers: { "message-id": "mg_1" } } },
    }));
    expect(e.type).toBe("delivered");
    expect(e.messageId).toBe("mg_1");
  });
});
