import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { ResendTransport } from "../../providers/resend/index.js";

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

function mockFetch(response: {
  ok?: boolean;
  status?: number;
  body?: unknown;
  json?: unknown;
}) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: response.ok ?? true,
    status: response.status ?? 200,
    json: vi.fn().mockResolvedValue(response.json ?? response.body ?? { id: "msg-123" }),
  }) as typeof fetch;
}

function getFetchCall(index = 0): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index] as [string, RequestInit];
}

describe("ResendTransport", () => {
  it("sends correct JSON payload", async () => {
    mockFetch({ ok: true, json: { id: "msg-123" } });
    const transport = new ResendTransport({ apiKey: "re_test" });
    const result = await transport.send(email);

    expect(result.messageId).toBe("msg-123");
    expect(result.transportId).toBe("resend");

    const [url, opts] = getFetchCall();
    expect(url).toBe("https://api.resend.com/emails");
    expect(opts.method).toBe("POST");

    const body = JSON.parse(opts.body as string);
    expect(body.from).toBe("sender@example.com");
    expect(body.to).toEqual(["recipient@example.com"]);
    expect(body.subject).toBe("Test");
    expect(body.html).toBe("<p>Hello</p>");
  });

  it("passes Authorization header", async () => {
    mockFetch({ ok: true });
    const transport = new ResendTransport({ apiKey: "re_secret" });
    await transport.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({ Authorization: "Bearer re_secret" });
  });

  it("formats name+address from field", async () => {
    mockFetch({ ok: true, json: { id: "1" } });
    const transport = new ResendTransport({ apiKey: "re_test" });
    await transport.send({
      ...email,
      from: { name: "Alice", address: "alice@example.com" },
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.from).toBe("Alice <alice@example.com>");
  });

  it("handles cc and bcc", async () => {
    mockFetch({ ok: true, json: { id: "1" } });
    const transport = new ResendTransport({ apiKey: "re_test" });
    await transport.send({
      ...email,
      cc: "cc@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.cc).toEqual(["cc@example.com"]);
    expect(body.bcc).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  it("includes custom headers", async () => {
    mockFetch({ ok: true, json: { id: "1" } });
    const transport = new ResendTransport({ apiKey: "re_test" });
    await transport.send({
      ...email,
      headers: { "X-Campaign": "test" },
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    expect(body.headers).toEqual({ "X-Campaign": "test" });
  });

  it("throws on API error with status code", async () => {
    mockFetch({
      ok: false,
      status: 429,
      json: { message: "Rate limited", name: "rate_limit_exceeded" },
    });
    const transport = new ResendTransport({ apiKey: "re_test" });

    await expect(transport.send(email)).rejects.toThrow("Rate limited");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, json: { message: "Too many" } });
    const transport = new ResendTransport({ apiKey: "re_test" });

    try {
      await transport.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 500 as retryable", async () => {
    mockFetch({ ok: false, status: 500, json: { message: "Server error" } });
    const transport = new ResendTransport({ apiKey: "re_test" });

    try {
      await transport.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 400 as non-retryable", async () => {
    mockFetch({ ok: false, status: 400, json: { message: "Bad request" } });
    const transport = new ResendTransport({ apiKey: "re_test" });

    try {
      await transport.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(false);
    }
  });

  it("uses custom baseUrl", async () => {
    mockFetch({ ok: true, json: { id: "1" } });
    const transport = new ResendTransport({
      apiKey: "re_test",
      baseUrl: "https://custom.api.com",
    });
    await transport.send(email);

    const [url] = getFetchCall();
    expect(url).toBe("https://custom.api.com/emails");
  });
});
