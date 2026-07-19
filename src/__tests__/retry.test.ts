import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../retry.js";
import type { Transport, SendError } from "../types.js";

function mockTransport(failCount: number, id = "mock") {
  let calls = 0;
  const transport: Transport & { callCount: number } = {
    id,
    callCount: 0,
    async send() {
      transport.callCount = ++calls;
      if (calls <= failCount) {
        const err = new Error("fail") as SendError;
        err.code = "TRANSIENT";
        err.transportId = id;
        err.retryable = true;
        err.statusCode = 503;
        throw err;
      }
      return { messageId: "ok", transportId: id, timestamp: new Date() };
    },
  };
  return transport;
}

describe("withRetry", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("returns on first success", async () => {
    const t = mockTransport(0);
    const retry = withRetry(t, { maxRetries: 3, initialDelay: 1 });
    const result = await retry.send({
      from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
    });
    expect(result.messageId).toBe("ok");
    expect(t.callCount).toBe(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const t = mockTransport(2);
    const retry = withRetry(t, { maxRetries: 3, initialDelay: 1 });
    const promise = retry.send({
      from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
    });
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(t.callCount).toBe(3);
  });

  it("throws after maxRetries exhausted", async () => {
    const t = mockTransport(10);
    const retry = withRetry(t, { maxRetries: 2, initialDelay: 1 });
    const promise = retry.send({
      from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
    }).catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    await promise;
    expect(t.callCount).toBe(3);
  });

  it("does not retry on non-retryable error", async () => {
    const t: Transport = {
      id: "mock",
      async send() {
        const err = new Error("bad") as SendError;
        err.code = "AUTH"; err.transportId = "mock";
        err.retryable = false; err.statusCode = 401;
        throw err;
      },
    };
    const retry = withRetry(t, { maxRetries: 3, initialDelay: 1 });
    const promise = retry.send({
      from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
    }).catch(() => {});
    await vi.advanceTimersByTimeAsync(100);
    await promise;
  });

  it("appends (retry) to transport id", () => {
    expect(withRetry(mockTransport(0, "smtp")).id).toBe("smtp(retry)");
  });
});
