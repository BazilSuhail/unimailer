import { describe, it, expect } from "vitest";
import { FailoverMailer } from "../failover.js";
import type { Transport, SendResult, EmailMessage } from "../types.js";

function ok(id: string): Transport {
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

describe("FailoverMailer", () => {
  it("throws on empty providers", () => {
    expect(() => new FailoverMailer([])).toThrow("at least one");
  });

  it("sends via first transport", async () => {
    const mailer = new FailoverMailer([ok("a"), ok("b")]);
    const result = await mailer.send(email);
    expect(result.transportId).toBe("a");
  });

  it("falls back on failure", async () => {
    const mailer = new FailoverMailer([fail("a"), ok("b")]);
    const result = await mailer.send(email);
    expect(result.transportId).toBe("b");
  });

  it("throws when all fail", async () => {
    const mailer = new FailoverMailer([fail("a"), fail("b")]);
    await expect(mailer.send(email)).rejects.toThrow("All 2 transports failed");
  });

  it("has id 'failover'", () => {
    expect(new FailoverMailer([ok("a")]).id).toBe("failover");
  });
});
