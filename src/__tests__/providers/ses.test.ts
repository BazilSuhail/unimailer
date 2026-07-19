import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SesTransport } from "../../providers/ses/index.js";

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
    json: vi.fn().mockResolvedValue(response.body ?? { MessageId: "ses-123" }),
  }) as typeof fetch;
}

function getFetchCall(index = 0): [string, RequestInit] {
  const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
  return calls[index] as [string, RequestInit];
}

describe("SesTransport", () => {
  it("has id 'ses'", () => {
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    expect(t.id).toBe("ses");
  });

  it("sends to correct endpoint", async () => {
    mockFetch({ ok: true, body: { MessageId: "ses-msg-123" } });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      region: "eu-west-1",
    });
    const result = await t.send(email);

    expect(result.messageId).toBe("ses-msg-123");
    expect(result.transportId).toBe("ses");

    const [url] = getFetchCall();
    expect(url).toContain("eu-west-1");
    expect(url).toContain("amazonaws.com");
  });

  it("includes Authorization header", async () => {
    mockFetch({ ok: true });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({
      Authorization: expect.stringContaining("AWS4-HMAC-SHA256"),
    });
  });

  it("includes X-Amz-Date header", async () => {
    mockFetch({ ok: true });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({
      "X-Amz-Date": expect.stringMatching(/^\d{8}T\d{6}Z$/),
    });
  });

  it("includes session token when provided", async () => {
    mockFetch({ ok: true });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
      sessionToken: "FwoGZXIvYXdzEBY",
    });
    await t.send(email);

    const [, opts] = getFetchCall();
    expect(opts.headers).toMatchObject({
      "X-Amz-Security-Token": "FwoGZXIvYXdzEBY",
    });
  });

  it("throws on API error", async () => {
    mockFetch({
      ok: false,
      status: 400,
      body: { Message: "Invalid parameter", Code: "InvalidParameterValue" },
    });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    await expect(t.send(email)).rejects.toThrow("Invalid parameter");
  });

  it("marks 429 as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { Message: "Throttled", Code: "Throttling" } });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("marks 500 as retryable", async () => {
    mockFetch({ ok: false, status: 500, body: { Message: "Internal error", Code: "InternalFailure" } });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });

    try {
      await t.send(email);
      expect.fail("should throw");
    } catch (err) {
      expect((err as Error & { retryable: boolean }).retryable).toBe(true);
    }
  });

  it("handles cc and bcc", async () => {
    mockFetch({ ok: true });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    await t.send({
      ...email,
      cc: "cc@example.com",
      bcc: ["bcc1@example.com", "bcc2@example.com"],
    });

    const [, opts] = getFetchCall();
    const body = JSON.parse(opts.body as string);
    const dest = body.Content.Simple.Destination;
    expect(dest.CcAddresses).toEqual(["cc@example.com"]);
    expect(dest.BccAddresses).toEqual(["bcc1@example.com", "bcc2@example.com"]);
  });

  it("uses default region us-east-1", async () => {
    mockFetch({ ok: true });
    const t = new SesTransport({
      accessKeyId: "AKIAIOSFODNN7EXAMPLE",
      secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
    });
    await t.send(email);

    const [url] = getFetchCall();
    expect(url).toContain("us-east-1");
  });
});
