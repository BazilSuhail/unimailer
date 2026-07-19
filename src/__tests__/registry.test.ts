import { describe, it, expect } from "vitest";
import { createMailer, sortProviders } from "../registry.js";
import type { Transport, EmailMessage, SendResult } from "../types.js";

function mock(id: string): Transport {
  return {
    id,
    async send(): Promise<SendResult> {
      return { messageId: `${id}-msg`, transportId: id, timestamp: new Date() };
    },
  };
}

function fail(id: string): Transport {
  return {
    id,
    async send(): Promise<SendResult> {
      throw new Error(`${id} failed`);
    },
  };
}

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

describe("createMailer", () => {
  it("throws with zero providers", () => {
    expect(() => createMailer({ providers: [] })).toThrow("at least one");
  });

  it("sends via single provider", async () => {
    const mailer = createMailer({ providers: [mock("t")], retry: false });
    const result = await mailer.send(email);
    expect(result.transportId).toBe("t");
  });

  it("uses failover when multiple providers", async () => {
    const mailer = createMailer({
      providers: [fail("a"), mock("b")], retry: false,
    });
    const result = await mailer.send(email);
    expect(result.transportId).toBe("b");
  });

  it("applies retry by default", async () => {
    let calls = 0;
    const t: Transport = {
      id: "flaky",
      async send() {
        calls++;
        if (calls < 2) {
          const err = new Error("transient") as Error & {
            code: string; transportId: string; retryable: boolean; statusCode?: number;
          };
          err.code = "T"; err.transportId = "flaky"; err.retryable = true; err.statusCode = 503;
          throw err;
        }
        return { messageId: "ok", transportId: "flaky", timestamp: new Date() };
      },
    };
    const mailer = createMailer({ providers: [t], retry: { maxRetries: 2, initialDelay: 1 } });
    await mailer.send(email);
    expect(calls).toBe(2);
  });
});

describe("sortProviders", () => {
  it("sorts by priority map", () => {
    const a = mock("a"), b = mock("b"), c = mock("c");
    expect(sortProviders([a, b, c], { c: 1, a: 2, b: 0 }).map((p) => p.id))
      .toEqual(["b", "c", "a"]);
  });
});
