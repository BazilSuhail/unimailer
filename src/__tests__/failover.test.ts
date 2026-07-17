import { describe, it, expect } from "vitest";
import { FailoverMailer } from "../failover.js";
import type { Transport, SendError } from "../types.js";

const email = {
  from: "a@b.com",
  to: "c@d.com",
  subject: "T",
  html: "<p>x</p>",
};

function successTransport(id: string): Transport {
  return {
    id,
    async send() {
      return { messageId: `ok-${id}`, transportId: id, timestamp: new Date() };
    },
  };
}

function failTransport(id: string): Transport {
  return {
    id,
    async send() {
      const err = new Error(`${id} failed`) as SendError;
      err.code = "FAIL";
      err.transportId = id;
      err.retryable = false;
      throw err;
    },
  };
}

describe("FailoverMailer", () => {
  it("throws on empty transports array", () => {
    expect(() => new FailoverMailer([])).toThrow("at least one transport");
  });

  it("uses first transport on success", async () => {
    const mailer = new FailoverMailer([
      successTransport("a"),
      successTransport("b"),
    ]);
    const result = await mailer.send(email);
    expect(result.transportId).toBe("a");
  });

  it("falls through to second transport on failure", async () => {
    const mailer = new FailoverMailer([
      failTransport("a"),
      successTransport("b"),
    ]);
    const result = await mailer.send(email);
    expect(result.transportId).toBe("b");
  });

  it("falls through multiple failures", async () => {
    const mailer = new FailoverMailer([
      failTransport("a"),
      failTransport("b"),
      successTransport("c"),
    ]);
    const result = await mailer.send(email);
    expect(result.transportId).toBe("c");
  });

  it("throws after all transports fail", async () => {
    const mailer = new FailoverMailer([
      failTransport("a"),
      failTransport("b"),
    ]);

    await expect(mailer.send(email)).rejects.toThrow("All 2 transports failed");
  });

  it("error includes each transport's failure", async () => {
    const mailer = new FailoverMailer([
      failTransport("a"),
      failTransport("b"),
    ]);

    try {
      await mailer.send(email);
      expect.fail("should have thrown");
    } catch (err) {
      expect((err as Error).message).toContain("[a] a failed");
      expect((err as Error).message).toContain("[b] b failed");
    }
  });

  it("has id 'failover'", () => {
    const mailer = new FailoverMailer([successTransport("a")]);
    expect(mailer.id).toBe("failover");
  });
});
