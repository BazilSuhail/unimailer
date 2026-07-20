import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MetricsCollector } from "../../middleware/metrics.js";
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
      return { messageId: `ok-${this.calls}`, transportId: "mock", timestamp: new Date() };
    },
  };
}

describe("MetricsCollector", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("appends (metrics) to id", () => {
    expect(new MetricsCollector(mockTransport()).id).toBe("mock(metrics)");
  });

  it("tracks successes", async () => {
    const t = mockTransport();
    const m = new MetricsCollector(t);
    await m.send(email);
    await m.send(email);
    const s = m.snapshot();
    expect(s.total).toBe(2);
    expect(s.success).toBe(2);
    expect(s.failure).toBe(0);
  });

  it("tracks failures", async () => {
    const m = new MetricsCollector(mockTransport(2));
    await m.send(email).catch(() => {});
    await m.send(email).catch(() => {});
    const s = m.snapshot();
    expect(s.total).toBe(2);
    expect(s.success).toBe(0);
    expect(s.failure).toBe(2);
    expect(s.errors).toHaveLength(2);
  });

  it("tracks latencies", async () => {
    const m = new MetricsCollector(mockTransport());
    await m.send(email);
    const s = m.snapshot();
    expect(s.latencies.length).toBe(1);
    expect(s.latencies[0]).toBeGreaterThanOrEqual(0);
  });

  it("groups by transport", async () => {
    const m = new MetricsCollector(mockTransport());
    await m.send(email);
    const s = m.snapshot();
    expect(s.byTransport["mock"]).toBeDefined();
    expect(s.byTransport["mock"]!.success).toBe(1);
    expect(s.byTransport["mock"]!.avgLatency).toBeGreaterThanOrEqual(0);
  });

  it("reset clears all", async () => {
    const m = new MetricsCollector(mockTransport());
    await m.send(email);
    m.reset();
    const s = m.snapshot();
    expect(s.total).toBe(0);
    expect(s.success).toBe(0);
  });

  it("passes errors through", async () => {
    const m = new MetricsCollector(mockTransport(1));
    await expect(m.send(email)).rejects.toThrow("fail");
    expect(m.snapshot().failure).toBe(1);
  });
});
