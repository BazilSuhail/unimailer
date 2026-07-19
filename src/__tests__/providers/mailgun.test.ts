import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { MailgunTransport } from "../../providers/mailgun/index.js";

const email = {
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test",
  html: "<p>Hello</p>",
};

let originalFetch: typeof globalThis.fetch;

beforeEach(() => {
  originalFetch = globalThis.fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

function mockFetch(response: { ok?: boolean; status?: number; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: vi.fn().mockResolvedValue(response.body ?? { id: "msg-123" }),
  }) as typeof fetch;
}

function getFetchCall(index = 0): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index] as [string, RequestInit];
}

describe("MailgunTransport", () => {
  it("has id 'mailgun'", () => {
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    expect(t.id).toBe("mailgun");
  });

  it("sends to correct endpoint", async () => {
    mockFetch({ ok: true, body: { id: "mg-msg-123" } });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    const result = await t.send(email);

    expect(result.messageId).toBe("mg-msg-123");
    expect(result.transportId).toBe("mailgun");

    const [url] = getFetchCall();
    expect(url).toBe("https://api.mailgun.net/v3/mg.example.com/messages");
  });

  it("uses EU region endpoint", async () => {
    mockFetch({ ok: true });
    const t = new MailgunTransport({
      apiKey: "mg_test",
      domain: "mg.example.com",
      region: "eu",
    });
    await t.send(email);

    const [url] = getFetchCall();
    expect(url).toContain("api.eu.mailgun.net");
  });

  it("sends basic auth header", async () => {
    mockFetch({ ok: true });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({
      Authorization: expect.stringContaining("Basic"),
    });
  });

  it("formats name+address from field", async () => {
    mockFetch({ ok: true });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    await t.send({
      ...email,
      from: { name: "Alice", address: "alice@example.com" },
    });

    const [, opts] = getFetchCall();
    const body = opts.body as FormData;
    expect(body.get("from")).toBe("Alice <alice@example.com>");
  });

  it("throws on API error", async () => {
    mockFetch({
      ok: false,
      status: 400,
      body: { message: "Invalid domain" },
    });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "bad" });

    await expect(t.send(email)).rejects.toThrow("Invalid domain");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Rate limited" } });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 500 as retryable", async () => {
    mockFetch({ ok: false, status: 500, body: { message: "Server error" } });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("sends custom headers with h: prefix", async () => {
    mockFetch({ ok: true });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    await t.send({
      ...email,
      headers: { "X-Campaign": "test" },
    });

    const [, opts] = getFetchCall();
    const body = opts.body as FormData;
    expect(body.get("h:X-Campaign")).toBe("test");
  });

  it("handles cc and bcc", async () => {
    mockFetch({ ok: true });
    const t = new MailgunTransport({ apiKey: "mg_test", domain: "mg.example.com" });
    await t.send({
      ...email,
      cc: "cc@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
    });

    const [, opts] = getFetchCall();
    const body = opts.body as FormData;
    expect(body.get("cc")).toBe("cc@example.com");
    const allBcc = body.getAll("bcc");
    expect(allBcc).toContain("bcc1@example.com");
    expect(allBcc).toContain("bcc2@example.com");
  });
});
