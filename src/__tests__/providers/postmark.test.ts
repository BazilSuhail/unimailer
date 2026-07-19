import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostmarkTransport } from "../../providers/postmark/index.js";

const email = {
  from: "sender@example.com", to: "recipient@example.com",
  subject: "Test", html: "<p>Hello</p>",
};

let origFetch: typeof globalThis.fetch;
beforeEach(() => { origFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = origFetch; });

function mockFetch(resp: { ok?: boolean; status?: number; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: resp.ok ?? true, status: resp.status ?? 200,
    json: vi.fn().mockResolvedValue(resp.body ?? { ErrorCode: 0 }),
  }) as typeof fetch;
}
function call(i = 0) { return (globalThis.fetch as any).mock.calls[i]; }

describe("PostmarkTransport", () => {
  it("sends to correct endpoint", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0, MessageID: "pm-123" } });
    const r = await new PostmarkTransport({ serverToken: "pm_test" }).send(email);
    expect(r.messageId).toBe("pm-123");
    expect(call()[0]).toBe("https://api.postmarkapp.com/email");
  });

  it("sends server token header", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    await new PostmarkTransport({ serverToken: "pm_k" }).send(email);
    expect(call()[1].headers).toMatchObject({ "X-Postmark-Server-Token": "pm_k" });
  });

  it("throws on API error code", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 11, Message: "Invalid token" } });
    await expect(new PostmarkTransport({ serverToken: "bad" }).send(email))
      .rejects.toThrow("Invalid token");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { ErrorCode: 0, Message: "Rate" } });
    try {
      await new PostmarkTransport({ serverToken: "pm_t" }).send(email);
    } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
  });
});
