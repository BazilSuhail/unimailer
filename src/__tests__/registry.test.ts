import { describe, it, expect } from "vitest";
import { createMailer, sortProviders } from "../registry.js";
import type { Transport, EmailMessage, SendResult } from "../types.js";

function mockTransport(id: string): Transport {
  return {
    id,
    async send(_msg: EmailMessage): Promise<SendResult> {
      return { messageId: `${id}-msg`, transportId: id, timestamp: new Date() };
    },
  };
}

function failingTransport(id: string): Transport {
  return {
    id,
    async send(): Promise<SendResult> {
      throw new Error(`${id} failed`);
    },
  };
}

const email: EmailMessage = {
  from: "a@b.com",
  to: "c@d.com",
  subject: "Test",
  html: "<p>x</p>",
};

describe("createMailer", () => {
  it("throws with zero providers", () => {
    expect(() => createMailer({ providers: [] })).toThrow("at least one");
  });

  it("creates mailer with single provider", async () => {
    const t = mockTransport("test");
    const mailer = createMailer({ providers: [t], retry: false });
    const result = await mailer.send(email);
    expect(result.messageId).toBe("test-msg");
    expect(result.transportId).toBe("test");
  });

  it("creates mailer with failover", async () => {
    const primary = failingTransport("primary");
    const fallback = mockTransport("fallback");
    const mailer = createMailer({
      providers: [primary, fallback],
      retry: false,
    });
    const result = await mailer.send(email);
    expect(result.transportId).toBe("fallback");
  });

  it("applies retry by default", async () => {
    let calls = 0;
    const flaky: Transport = {
      id: "flaky",
      async send() {
        calls++;
        if (calls < 2) {
          const err = new Error("transient") as Error & { code: string; transportId: string; retryable: boolean; statusCode?: number };
          err.code = "TRANSIENT";
          err.transportId = "flaky";
          err.retryable = true;
          err.statusCode = 503;
          throw err;
        }
        return { messageId: "ok", transportId: "flaky", timestamp: new Date() };
      },
    };
    const mailer = createMailer({
      providers: [flaky],
      retry: { maxRetries: 2, initialDelay: 1 },
    });
    const result = await mailer.send(email);
    expect(result.messageId).toBe("ok");
    expect(calls).toBe(2);
  });

  it("disables retry with false", async () => {
    let calls = 0;
    const t: Transport = {
      id: "t",
      async send() {
        calls++;
        return { messageId: "ok", transportId: "t", timestamp: new Date() };
      },
    };
    const mailer = createMailer({ providers: [t], retry: false });
    await mailer.send(email);
    expect(calls).toBe(1);
  });

  it("returns transport reference", () => {
    const t = mockTransport("t");
    const mailer = createMailer({ providers: [t], retry: false });
    expect(mailer.transport).toBeDefined();
    expect(mailer.transport.id).toBe("t");
  });
});

describe("sortProviders", () => {
  it("sorts by priority map", () => {
    const a = mockTransport("a");
    const b = mockTransport("b");
    const c = mockTransport("c");
    const sorted = sortProviders([a, b, c], { c: 1, a: 2, b: 0 });
    expect(sorted.map((p) => p.id)).toEqual(["b", "c", "a"]);
  });

  it("returns original order without priorities", () => {
    const a = mockTransport("a");
    const b = mockTransport("b");
    const sorted = sortProviders([a, b]);
    expect(sorted.map((p) => p.id)).toEqual(["a", "b"]);
  });
});
