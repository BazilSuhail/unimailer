import { describe, it, expect } from "vitest";
import { Mailer, createSendError } from "../transport.js";
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

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

describe("Mailer", () => {
  it("delegates to transport", async () => {
    const t = mockTransport();
    const mailer = new Mailer(t);
    await mailer.send(email);
    expect(t.calls.length).toBe(1);
  });

  it("validates before send", async () => {
    const t = mockTransport();
    const mailer = new Mailer(t);
    await expect(mailer.send({ from: "bad" } as any)).rejects.toThrow();
    expect(t.calls.length).toBe(0);
  });
});

describe("createSendError", () => {
  it("creates error with defaults", () => {
    const err = createSendError("fail", "smtp");
    expect(err.message).toBe("fail");
    expect(err.code).toBe("SEND_FAILED");
    expect(err.transportId).toBe("smtp");
    expect(err.retryable).toBe(false);
  });

  it("creates error with custom options", () => {
    const cause = new Error("root");
    const err = createSendError("fail", "smtp", {
      code: "TIMEOUT",
      statusCode: 408,
      retryable: true,
      cause,
    });
    expect(err.code).toBe("TIMEOUT");
    expect(err.statusCode).toBe(408);
    expect(err.retryable).toBe(true);
    expect(err.cause).toBe(cause);
  });
});
