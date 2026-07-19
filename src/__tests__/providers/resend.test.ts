import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResendTransport } from "../../providers/resend/index.js";

const email = {
  from: "sender@example.com", to: "recipient@example.com",
  subject: "Test", html: "<p>Hello</p>",
};

let origFetch: typeof globalThis.fetch;
beforeEach(() => { origFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = origFetch; });

function mockFetch(resp: { ok?: boolean; status?: number; json?: unknown; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: resp.ok ?? true, status: resp.status ?? 200,
    json: vi.fn().mockResolvedValue(resp.json ?? resp.body ?? { id: "msg-123" }),
  }) as typeof fetch;
}
function call(i = 0) { return (globalThis.fetch as any).mock.calls[i]; }

describe("ResendTransport", () => {
  it("sends correct payload", async () => {
    mockFetch({ ok: true, json: { id: "r-123" } });
    const t = new ResendTransport({ apiKey: "re_test" });
    const r = await t.send(email);
    expect(r.messageId).toBe("r-123");
    expect(call()[0]).toBe("https://api.resend.com/emails");
  });

  it("sends Authorization header", async () => {
    mockFetch({ ok: true });
    await new ResendTransport({ apiKey: "re_k" }).send(email);
    expect(call()[1].headers.Authorization).toBe("Bearer re_k");
  });

  it("throws on API error", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Rate limited" } });
    await expect(new ResendTransport({ apiKey: "re_test" }).send(email))
      .rejects.toThrow("Rate limited");
  });

  it("marks 429 and 500 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Too many" } });
    try {
      await new ResendTransport({ apiKey: "re_test" }).send(email);
    } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
    mockFetch({ ok: false, status: 500, body: { message: "Err" } });
    try {
      await new ResendTransport({ apiKey: "re_test" }).send(email);
    } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
  });
});
