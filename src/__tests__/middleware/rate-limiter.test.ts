import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { withRateLimiter } from "../../middleware/rate-limiter.js";
import type { Transport, EmailMessage, SendResult } from "../../types.js";

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

function mockTransport(): Transport & { calls: number } {
  return {
    id: "mock",
    calls: 0,
    async send(): Promise<SendResult> {
      this.calls++;
      return { messageId: `m-${this.calls}`, transportId: "mock", timestamp: new Date() };
    },
  };
}

describe("withRateLimiter", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("appends (rate-limited) to id", () => {
    const t = mockTransport();
    const rl = withRateLimiter(t, { maxPerSecond: 10 });
    expect(rl.id).toBe("mock(rate-limited)");
  });

  it("allows sends under the limit", async () => {
    const t = mockTransport();
    const rl = withRateLimiter(t, { maxPerSecond: 5 });
    const result = await rl.send(email);
    expect(result.messageId).toBeDefined();
    expect(t.calls).toBe(1);
  });

  it("throttles when limit exceeded", async () => {
    const t = mockTransport();
    const rl = withRateLimiter(t, { maxPerSecond: 2 });
    await rl.send(email);
    await rl.send(email);
    const third = rl.send(email);
    let resolved = false;
    third.then(() => { resolved = true; });
    await vi.advanceTimersByTimeAsync(100);
    expect(resolved).toBe(false);
    await vi.advanceTimersByTimeAsync(1000);
    await third;
    expect(t.calls).toBe(3);
  });

  it("passes errors through", async () => {
    const t: Transport = {
      id: "fail",
      async send() { throw new Error("boom"); },
    };
    const rl = withRateLimiter(t, { maxPerSecond: 10 });
    await expect(rl.send(email)).rejects.toThrow("boom");
  });
});
