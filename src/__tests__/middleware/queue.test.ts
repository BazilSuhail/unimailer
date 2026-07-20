import { describe, it, expect } from "vitest";
import { MailQueue } from "../../middleware/queue.js";
import type { Transport, EmailMessage, SendResult } from "../../types.js";

const email: EmailMessage = {
  from: "a@b.com", to: "c@d.com", subject: "T", html: "<p>x</p>",
};

function mockTransport(delay = 0): Transport & { calls: number } {
  return {
    id: "mock",
    calls: 0,
    async send(): Promise<SendResult> {
      this.calls++;
      if (delay) await new Promise((r) => setTimeout(r, delay));
      return { messageId: `m-${this.calls}`, transportId: "mock", timestamp: new Date() };
    },
  };
}

describe("MailQueue", () => {
  it("appends (queued) to id", () => {
    const q = new MailQueue(mockTransport(), { concurrency: 2 });
    expect(q.id).toBe("mock(queued)");
  });

  it("sends immediately when under concurrency", async () => {
    const t = mockTransport();
    const q = new MailQueue(t, { concurrency: 2 });
    const result = await q.send(email);
    expect(result.messageId).toBeDefined();
    expect(t.calls).toBe(1);
  });

  it("respects concurrency limit", async () => {
    const t = mockTransport(100);
    const q = new MailQueue(t, { concurrency: 1 });
    const p1 = q.send(email);
    const p2 = q.send(email);
    await new Promise((r) => setTimeout(r, 10));
    expect(t.calls).toBe(1);
    expect(q.active).toBe(1);
    expect(q.size).toBe(1);
    await Promise.all([p1, p2]);
    expect(t.calls).toBe(2);
  });

  it("throws when queue full", async () => {
    const t = mockTransport(200);
    const q = new MailQueue(t, { concurrency: 1, maxSize: 2 });
    const p1 = q.send(email);
    const p2 = q.send(email);
    await new Promise((r) => setTimeout(r, 10));
    await expect(q.send(email)).rejects.toThrow("Queue is full");
    await Promise.all([p1, p2]);
  });

  it("close drains pending", async () => {
    const t = mockTransport(50);
    const q = new MailQueue(t, { concurrency: 2 });
    q.send(email);
    q.send(email);
    await q.close();
    expect(q.size).toBe(0);
    expect(q.active).toBe(0);
  });

  it("close rejects new sends", async () => {
    const q = new MailQueue(mockTransport(), { concurrency: 1 });
    await q.close();
    await expect(q.send(email)).rejects.toThrow("closed");
  });
});
