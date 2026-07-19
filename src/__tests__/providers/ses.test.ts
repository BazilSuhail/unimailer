import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SesTransport } from "../../providers/ses/index.js";

const email = {
  from: "sender@example.com", to: "recipient@example.com",
  subject: "Test", html: "<p>Hello</p>",
};
const CREDS = { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY" };

let origFetch: typeof globalThis.fetch;
beforeEach(() => { origFetch = globalThis.fetch; });
afterEach(() => { globalThis.fetch = origFetch; });

function mockFetch(resp: { ok?: boolean; status?: number; body?: unknown }) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    ok: resp.ok ?? true, status: resp.status ?? 200,
    json: vi.fn().mockResolvedValue(resp.body ?? { MessageId: "ses-123" }),
  }) as typeof fetch;
}
function call(i = 0) { return (globalThis.fetch as any).mock.calls[i]; }

describe("SesTransport", () => {
  it("sends to SES endpoint with auth", async () => {
    mockFetch({ ok: true, body: { MessageId: "ses-1" } });
    const r = await new SesTransport(CREDS).send(email);
    expect(r.messageId).toBe("ses-1");
    const [url, opts] = call();
    expect(url).toContain("us-east-1");
    expect(url).toContain("amazonaws.com");
    expect(opts.headers).toMatchObject({ Authorization: expect.stringContaining("AWS4-HMAC-SHA256") });
  });

  it("uses custom region", async () => {
    mockFetch({ ok: true });
    await new SesTransport({ ...CREDS, region: "eu-west-1" }).send(email);
    expect(call()[0]).toContain("eu-west-1");
  });

  it("throws on API error", async () => {
    mockFetch({ ok: false, status: 400, body: { Message: "Invalid", Code: "Bad" } });
    await expect(new SesTransport(CREDS).send(email)).rejects.toThrow("Invalid");
  });

  it("marks 429 and throttling as retryable", async () => {
    mockFetch({ ok: false, status: 429, body: { Message: "Rate", Code: "Throttling" } });
    try { await new SesTransport(CREDS).send(email); } catch (e) {
      expect((e as any).retryable).toBe(true);
    }
  });
});
