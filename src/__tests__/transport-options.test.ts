import { describe, it, expect, vi } from "vitest";
import { Mailer } from "../transport.js";
import type { Transport, EmailMessage, SendResult, SendError } from "../types.js";

function mockTransport(id = "mock"): Transport & { calls: EmailMessage[] } {
  return {
    id,
    calls: [],
    async send(msg: EmailMessage): Promise<SendResult> {
      this.calls.push(msg);
      return { messageId: "msg-1", transportId: id, timestamp: new Date() };
    },
  };
}

function failingTransport(id = "fail"): Transport {
  return {
    id,
    async send(): Promise<SendResult> {
      const err = new Error("boom") as SendError;
      err.code = "TEST_ERROR";
      err.transportId = id;
      err.retryable = false;
      throw err;
    },
  };
}

const email: EmailMessage = {
  from: "a@b.com",
  to: "c@d.com",
  subject: "Test",
  html: "<p>Hello</p>",
};

describe("Mailer options", () => {
  describe("dryRun", () => {
    it("does not call transport when dryRun is true", async () => {
      const t = mockTransport();
      const mailer = new Mailer(t, { dryRun: true });
      await mailer.send(email);
      expect(t.calls.length).toBe(0);
    });

    it("returns result with rawMime when dryRun is true", async () => {
      const t = mockTransport();
      const mailer = new Mailer(t, { dryRun: true });
      const result = await mailer.send(email);
      expect(result.messageId).toMatch(/^dry-run-/);
      expect(result.rawMime).toBeDefined();
      expect(result.rawMime).toContain("From: a@b.com");
      expect(result.rawMime).toContain("Subject: Test");
    });

    it("calls transport when dryRun is false", async () => {
      const t = mockTransport();
      const mailer = new Mailer(t, { dryRun: false });
      await mailer.send(email);
      expect(t.calls.length).toBe(1);
    });
  });

  describe("inlineCss", () => {
    it("inlines CSS when inlineCss is true", async () => {
      const t = mockTransport();
      const mailer = new Mailer(t, { inlineCss: true });
      await mailer.send({
        ...email,
        html: '<style>.x { color: red; }</style><p class="x">Hi</p>',
      });
      expect(t.calls[0]!.html).toContain('style="color: red;"');
      expect(t.calls[0]!.html).not.toContain("<style>");
    });

    it("leaves html unchanged when inlineCss is false", async () => {
      const t = mockTransport();
      const mailer = new Mailer(t, { inlineCss: false });
      await mailer.send({
        ...email,
        html: '<style>.x { color: red; }</style><p class="x">Hi</p>',
      });
      expect(t.calls[0]!.html).toContain("<style>");
    });
  });

  describe("onSend hook", () => {
    it("calls onSend after successful send", async () => {
      const onSend = vi.fn();
      const t = mockTransport();
      const mailer = new Mailer(t, { onSend });
      const result = await mailer.send(email);
      expect(onSend).toHaveBeenCalledTimes(1);
      expect(onSend).toHaveBeenCalledWith(email, result);
    });

    it("does not call onSend on failure", async () => {
      const onSend = vi.fn();
      const t = failingTransport();
      const mailer = new Mailer(t, { onSend });
      await mailer.send(email).catch(() => {});
      expect(onSend).not.toHaveBeenCalled();
    });
  });

  describe("onError hook", () => {
    it("calls onError on failure", async () => {
      const onError = vi.fn();
      const t = failingTransport();
      const mailer = new Mailer(t, { onError });
      await mailer.send(email).catch(() => {});
      expect(onError).toHaveBeenCalledTimes(1);
      expect(onError).toHaveBeenCalledWith(email, expect.objectContaining({ code: "TEST_ERROR" }));
    });

    it("does not call onError on success", async () => {
      const onError = vi.fn();
      const t = mockTransport();
      const mailer = new Mailer(t, { onError });
      await mailer.send(email);
      expect(onError).not.toHaveBeenCalled();
    });
  });
});
