import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PostmarkTransport } from "../../providers/postmark/index.js";

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
    json: vi.fn().mockResolvedValue(response.body ?? {}),
  }) as typeof fetch;
}

function getFetchCall(index = 0): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index] as [string, RequestInit];
}

describe("PostmarkTransport", () => {
  it("has id 'postmark'", () => {
    const t = new PostmarkTransport({ serverToken: "pm_test" });
    expect(t.id).toBe("postmark");
  });

  it("sends correct payload", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0, MessageID: "pm-123" } });
    const t = new PostmarkTransport({ serverToken: "pm_test" });
    const result = await t.send(email);

    expect(result.messageId).toBe("pm-123");
    expect(result.transportId).toBe("postmark");

    const [url, opts] = getFetchCall();
    expect(url).toBe("https://api.postmarkapp.com/email");
    expect(opts.method).toBe("POST");
  });

  it("passes server token header", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    const t = new PostmarkTransport({ serverToken: "pm_secret" });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({
      "X-Postmark-Server-Token": "pm_secret",
    });
  });

  it("uses Postmark-style address formatting", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    const t = new PostmarkTransport({ serverToken: "pm_test" });
    await t.send({
      ...email,
      from: { name: "Alice", address: "alice@example.com" },
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.From).toBe("Alice <alice@example.com>");
  });

  it("handles cc and bcc", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    const t = new PostmarkTransport({ serverToken: "pm_test" });
    await t.send({
      ...email,
      cc: "cc@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.Cc).toBe("cc@example.com");
    expect(body.Bcc).toBe("bcc1@example.com, bcc2@example.com");
  });

  it("uses custom message stream", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    const t = new PostmarkTransport({
      serverToken: "pm_test",
      messageStream: "transactional",
    });
    await t.send(email);

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.MessageStream).toBe("transactional");
  });

  it("uses custom baseUrl", async () => {
    mockFetch({ ok: true, body: { ErrorCode: 0 } });
    const t = new PostmarkTransport({
      serverToken: "pm_test",
      baseUrl: "https://custom.postmark.com",
    });
    await t.send(email);

    const [url] = getFetchCall();
    expect(url).toBe("https://custom.postmark.com/email");
  });

  it("throws on API error", async () => {
    mockFetch({
      ok: true,
      body: { ErrorCode: 11, Message: "Invalid token" },
    });
    const t = new PostmarkTransport({ serverToken: "bad" });

    await expect(t.send(email)).rejects.toThrow("Invalid token");
  });

  it("throws on HTTP error", async () => {
    mockFetch({
      ok: false,
      status: 401,
      body: { ErrorCode: 0, Message: "Unauthorized" },
    });
    const t = new PostmarkTransport({ serverToken: "bad" });

    await expect(t.send(email)).rejects.toThrow();
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { ErrorCode: 0, Message: "Rate limited" } });
    const t = new PostmarkTransport({ serverToken: "pm_test" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 500 as retryable", async () => {
    mockFetch({ ok: false, status: 500, body: { ErrorCode: 0, Message: "Server error" } });
    const t = new PostmarkTransport({ serverToken: "pm_test" });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });
});
