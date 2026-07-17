import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRetry } from "../retry.js";
import type { Transport, SendError } from "../types.js";

function mockTransport(
  failCount: number,
  id = "mock",
): Transport & { callCount: number } {
  let calls = 0;
  return {
    id,
    callCount: 0,
    async send() {
      this.callCount = ++calls;
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
}

function nonRetryableError(): SendError {
  const err = new Error("bad request") as SendError;
  err.code = "AUTH_ERROR";
  err.transportId = "mock";
  err.retryable = false;
  err.statusCode = 401;
  return err;
}

describe("withRetry", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns result on first success", async () => {
    const transport = mockTransport(0);
    const retry = withRetry(transport, { maxRetries: 3, initialDelay: 1 });
    const result = await retry.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    });
    expect(result.messageId).toBe("ok");
    expect(transport.callCount).toBe(1);
  });

  it("retries on retryable error and succeeds", async () => {
    const transport = mockTransport(2);
    const retry = withRetry(transport, { maxRetries: 3, initialDelay: 1 });

    const promise = retry.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    });

    await vi.advanceTimersByTimeAsync(100);
    const result = await promise;
    expect(result.messageId).toBe("ok");
    expect(transport.callCount).toBe(3);
  });

  it("throws after maxRetries exhausted", async () => {
    const transport = mockTransport(10);
    const retry = withRetry(transport, { maxRetries: 2, initialDelay: 1 });

    const promise = retry.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    }).catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await promise;

    expect(transport.callCount).toBe(3);
  });

  it("does not retry on non-retryable error", async () => {
    const transport: Transport = {
      id: "mock",
      async send() {
        throw nonRetryableError();
      },
    };
    const retry = withRetry(transport, { maxRetries: 3, initialDelay: 1 });

    const promise = retry.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    }).catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await promise;
  });

  it("appends (retry) to transport id", () => {
    const transport = mockTransport(0, "smtp");
    const retry = withRetry(transport);
    expect(retry.id).toBe("smtp(retry)");
  });

  it("respects custom retryOn function", async () => {
    const transport: Transport = {
      id: "mock",
      async send() {
        const err = new Error("rate limit") as SendError;
        err.code = "RATE_LIMIT";
        err.transportId = "mock";
        err.retryable = false;
        err.statusCode = 429;
        throw err;
      },
    };

    const retry = withRetry(transport, {
      maxRetries: 2,
      initialDelay: 1,
      retryOn: (e) => e.statusCode === 429,
    });

    const promise = retry.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    }).catch(() => {});

    await vi.advanceTimersByTimeAsync(100);
    await promise;
  });
});
