import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SendGridTransport } from "../../providers/sendgrid/index.js";

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

function mockFetch(response: { ok?: boolean; status?: number; headers?: Record<string, string>; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    headers: { get: (h: string) => response.headers?.[h] ?? null } as Headers,
    json: vi.fn().mockResolvedValue(response.body ?? {}),
  }) as typeof fetch;
}

function getFetchCall(index = 0): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index] as [string, RequestInit];
}

describe("SendGridTransport", () => {
  it("has id 'sendgrid'", () => {
    const t = new SendGridTransport({ apiKey: "sg_test" });
    expect(t.id).toBe("sendgrid");
  });

  it("sends correct payload", async () => {
    mockFetch({ ok: true, headers: { "x-message-id": "sg-123" } });
    const t = new SendGridTransport({ apiKey: "sg_test" });
    const result = await t.send(email);

    expect(result.messageId).toBe("sg-123");
    expect(result.transportId).toBe("sendgrid");

    const [url, opts] = getFetchCall();
    expect(url).toBe("https://api.sendgrid.com/v3/mail/send");
    expect(opts.method).toBe("POST");
  });

  it("passes Authorization header", async () => {
    mockFetch({ ok: true });
    const t = new SendGridTransport({ apiKey: "sg_secret" });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({ Authorization: "Bearer sg_secret" });
  });

  it("uses custom baseUrl", async () => {
    mockFetch({ ok: true });
    const t = new SendGridTransport({
      apiKey: "sg_test",
      baseUrl: "https://custom.api.com",
    });
    await t.send(email);

    const [url] = getFetchCall();
    expect(url).toBe("https://custom.api.com/v3/mail/send");
  });

  it("formats name+address from field", async () => {
    mockFetch({ ok: true });
    const t = new SendGridTransport({ apiKey: "sg_test" });
    await t.send({
      ...email,
      from: { name: "Alice", address: "alice@example.com" },
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.from).toEqual({ email: "alice@example.com", name: "Alice" });
  });

  it("handles cc and bcc", async () => {
    mockFetch({ ok: true });
    const t = new SendGridTransport({ apiKey: "sg_test" });
    await t.send({
      ...email,
      cc: "cc@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.personalizations[0].cc).toEqual([{ email: "cc@example.com" }]);
    expect(body.personalizations[0].bcc).toEqual([
      { email: "bcc1@example.com" },
      { email: "bcc2@example.com" },
    ]);
  });

  it("enables sandbox mode", async () => {
    mockFetch({ ok: true });
    const t = new SendGridTransport({ apiKey: "sg_test", sandboxMode: true });
    await t.send(email);

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.mail_settings.sandbox_mode.enable).toBe(true);
  });

  it("throws on API error", async () => {
    mockFetch({
      ok: false,
      status: 400,
      body: { errors: [{ message: "Invalid from" }] },
    });
    const t = new SendGridTransport({ apiKey: "sg_test" });

    await expect(t.send(email)).rejects.toThrow("Invalid from");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { message: "Rate limited" } });
    const t = new SendGridTransport({ apiKey: "sg_test" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 500 as retryable", async () => {
    mockFetch({ ok: false, status: 500, body: { message: "Server error" } });
    const t = new SendGridTransport({ apiKey: "sg_test" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("falls back to timestamp message ID when header missing", async () => {
    mockFetch({ ok: true, headers: {} });
    const t = new SendGridTransport({ apiKey: "sg_test" });
    const result = await t.send(email);
    expect(result.messageId).toMatch(/^sg-/);
  });
});
