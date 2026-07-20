import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { CircuitBreaker } from "../../middleware/circuit-breaker.js";
import type { Transport, EmailMessage, SendResult, SendError } from "../../types.js";

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

function mockTransport(failCount = 0): Transport & { calls: number } {
  return {
    id: "mock",
    calls: 0,
    async send(): Promise<SendResult> {
      this.calls++;
      if (this.calls <= failCount) {
        const err = new Error("fail") as SendError;
        err.code = "TRANSIENT"; err.transportId = "mock";
        err.retryable = true; err.statusCode = 503;
        throw err;
      }
      return { messageId: "ok", transportId: "mock", timestamp: new Date() };
    },
  };
}

describe("CircuitBreaker", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("starts in closed state", () => {
    const cb = new CircuitBreaker(mockTransport(), {
      failureThreshold: 3, halfOpenAfter: 1000,
    });
    expect(cb.getState()).toBe("closed");
  });

  it("opens after failure threshold", async () => {
    const cb = new CircuitBreaker(mockTransport(3), {
      failureThreshold: 3, halfOpenAfter: 5000,
    });
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    expect(cb.getState()).toBe("open");
  });

  it("rejects when open", async () => {
    const cb = new CircuitBreaker(mockTransport(3), {
      failureThreshold: 3, halfOpenAfter: 5000,
    });
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await expect(cb.send(email)).rejects.toThrow("Circuit breaker is open");
  });

  it("transitions to half-open after timeout", async () => {
    const cb = new CircuitBreaker(mockTransport(3), {
      failureThreshold: 3, halfOpenAfter: 5000,
    });
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await vi.advanceTimersByTimeAsync(5001);
    expect(cb.getState()).toBe("half-open");
  });

  it("closes after 2 successes in half-open", async () => {
    const t = mockTransport(3);
    const cb = new CircuitBreaker(t, {
      failureThreshold: 3, halfOpenAfter: 5000,
    });
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await vi.advanceTimersByTimeAsync(5001);
    await cb.send(email);
    await cb.send(email);
    expect(cb.getState()).toBe("closed");
  });

  it("reset returns to closed", async () => {
    const cb = new CircuitBreaker(mockTransport(3), {
      failureThreshold: 3, halfOpenAfter: 5000,
    });
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    await cb.send(email).catch(() => {});
    expect(cb.getState()).toBe("open");
    cb.reset();
    expect(cb.getState()).toBe("closed");
  });
});
