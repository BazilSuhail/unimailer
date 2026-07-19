import { describe, it, expect, vi } from "vitest";
import { Mailer } from "../transport.js";
import type { Transport, EmailMessage } from "../types.js";

function mockTransport(): Transport & { calls: EmailMessage[] } {
  return {
    id: "mock",
    calls: [],
    async send(msg) {
      this.calls.push(msg);
      return { messageId: "msg-1", transportId: "mock", timestamp: new Date() };
    },
  };
}

function failingTransport(): Transport {
  return {
    id: "fail",
    async send() {
      const err = new Error("boom") as Error & { code: string; transportId: string; retryable: boolean };
      err.code = "ERR"; err.transportId = "fail"; err.retryable = false;
      throw err;
    },
  };
}

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

describe("Mailer options", () => {
  it("dryRun does not call transport and returns rawMime", async () => {
    const t = mockTransport();
    const mailer = new Mailer(t, { dryRun: true });
    const result = await mailer.send(email);
    expect(t.calls.length).toBe(0);
    expect(result.rawMime).toBeDefined();
    expect(result.rawMime).toContain("From: a@b.com");
  });

  it("inlineCss inlines style blocks", async () => {
    const t = mockTransport();
    const mailer = new Mailer(t, { inlineCss: true });
    await mailer.send({
      ...email,
      html: '<style>.x { color: red; }</style><p class="x">Hi</p>',
    });
    expect(t.calls[0]!.html).toContain('style="color: red;"');
    expect(t.calls[0]!.html).not.toContain("<style>");
  });

  it("onSend fires after success", async () => {
    const onSend = vi.fn();
    const t = mockTransport();
    const mailer = new Mailer(t, { onSend });
    await mailer.send(email);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it("onError fires on failure", async () => {
    const onError = vi.fn();
    const t = failingTransport();
    const mailer = new Mailer(t, { onError });
    await mailer.send(email).catch(() => {});
    expect(onError).toHaveBeenCalledTimes(1);
  });
});
