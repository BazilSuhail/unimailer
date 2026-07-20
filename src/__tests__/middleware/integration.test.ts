import { describe, it, expect } from "vitest";
import { createMailer } from "../../registry.js";
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

describe("createMailer Phase 5 options", () => {
  it("metrics option exposes metrics collector", async () => {
    const m = createMailer({ providers: [mockTransport()], retry: false, metrics: true });
    expect(m.metrics).toBeDefined();
    await m.send(email);
    expect(m.metrics!.snapshot().total).toBe(1);
  });

  it("circuitBreaker option exposes circuit breaker", () => {
    const m = createMailer({
      providers: [mockTransport()],
      retry: false,
      circuitBreaker: { failureThreshold: 3, halfOpenAfter: 5000 },
    });
    expect(m.circuitBreaker).toBeDefined();
    expect(m.circuitBreaker!.getState()).toBe("closed");
  });

  it("queue option exposes queue", () => {
    const m = createMailer({
      providers: [mockTransport()],
      retry: false,
      queue: { concurrency: 2 },
    });
    expect(m.queue).toBeDefined();
    expect(m.queue!.size).toBe(0);
  });

  it("all options together", async () => {
    const m = createMailer({
      providers: [mockTransport()],
      retry: false,
      metrics: true,
      circuitBreaker: { failureThreshold: 3, halfOpenAfter: 5000 },
      rateLimit: { maxPerSecond: 100 },
      queue: { concurrency: 1 },
    });
    expect(m.metrics).toBeDefined();
    expect(m.circuitBreaker).toBeDefined();
    expect(m.queue).toBeDefined();
    await m.send(email);
    expect(m.metrics!.snapshot().total).toBe(1);
  });
});
