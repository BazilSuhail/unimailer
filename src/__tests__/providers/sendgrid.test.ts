import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendGridTransport } from "../../providers/sendgrid/index.js";

const email = {
  from: "sender@example.com", to: "recipient@example.com",
  subject: "Test", html: "<p>Hello</p>",
};

let origFetch: typeof globalThis.fetch;
beforeEach(() => { origFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = origFetch; });

function mockFetch(resp: { ok?: boolean; status?: number; headers?: Record<string, string>; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: resp.ok ?? true, status: resp.status ?? 200,
    headers: { get: (h: string) => resp.headers?.[h] ?? null } as Headers,
    json: vi.fn().mockResolvedValue(resp.body ?? {}),
  }) as typeof fetch;
}
function call(i = 0) { return (globalThis.fetch as any).mock.calls[i]; }

describe("SendGridTransport", () => {
  it("sends to correct endpoint", async () => {
    mockFetch({ ok: true, headers: { "x-message-id": "sg-123" } });
    const r = await new SendGridTransport({ apiKey: "sg_test" }).send(email);
    expect(r.messageId).toBe("sg-123");
    expect(call()[0]).toContain("/v3/mail/send");
  });

  it("sends Authorization header", async () => {
    mockFetch({ ok: true });
    await new SendGridTransport({ apiKey: "sg_k" }).send(email);
    expect(call()[1].headers).toMatchObject({ Authorization: "Bearer sg_k" });
  });

  it("throws on API error", async () => {
    mockFetch({ ok: false, status: 400, body: { errors: [{ message: "Bad" }] } });
    await expect(new SendGridTransport({ apiKey: "sg_test" }).send(email))
      .rejects.toThrow("Bad");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Rate limited" } });
    try {
      await new SendGridTransport({ apiKey: "sg_test" }).send(email);
    } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
  });
});
