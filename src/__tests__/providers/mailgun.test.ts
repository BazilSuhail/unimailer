import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MailgunTransport } from "../../providers/mailgun/index.js";

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
    json: vi.fn().mockResolvedValue(resp.body ?? { id: "mg-123" }),
  }) as typeof fetch;
}
function call(i = 0) { return (globalThis.fetch as any).mock.calls[i]; }

describe("MailgunTransport", () => {
  it("sends to correct endpoint", async () => {
    mockFetch({ ok: true, body: { id: "mg-1" } });
    const r = await new MailgunTransport({ apiKey: "mg_k", domain: "mg.ex.com" }).send(email);
    expect(r.messageId).toBe("mg-1");
    expect(call()[0]).toBe("https://api.mailgun.net/v3/mg.ex.com/messages");
  });

  it("uses EU region", async () => {
    mockFetch({ ok: true });
    await new MailgunTransport({ apiKey: "mg_k", domain: "d", region: "eu" }).send(email);
    expect(call()[0]).toContain("api.eu.mailgun.net");
  });

  it("sends Basic auth", async () => {
    mockFetch({ ok: true });
    await new MailgunTransport({ apiKey: "mg_k", domain: "d" }).send(email);
    expect(call()[1].headers).toMatchObject({ Authorization: expect.stringContaining("Basic") });
  });

  it("throws on API error", async () => {
    mockFetch({ ok: false, status: 400, body: { message: "Invalid domain" } });
    await expect(new MailgunTransport({ apiKey: "k", domain: "bad" }).send(email))
      .rejects.toThrow("Invalid domain");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Rate" } });
    try {
      await new MailgunTransport({ apiKey: "k", domain: "d" }).send(email);
    } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
  });
});
