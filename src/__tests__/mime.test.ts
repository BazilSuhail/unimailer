import { describe, it, expect } from "vitest";
import { encodeMessage } from "../mime.js";
import type { EmailMessage } from "../types.js";

const msg = (overrides: Partial<EmailMessage> = {}): EmailMessage => ({
  from: "sender@example.com",
  to: "recipient@example.com",
  subject: "Test Subject",
  html: "<p>Hello</p>",
  ...overrides,
});

describe("encodeMessage", () => {
  it("includes all required headers", async () => {
    const result = await encodeMessage(msg());
    expect(result).toContain("MIME-Version: 1.0");
    expect(result).toContain("From: sender@example.com");
    expect(result).toContain("To: recipient@example.com");
    expect(result).toContain("Subject: Test Subject");
    expect(result).toMatch(/Date: /);
  });

  it("formats name+address and array recipients", async () => {
    const result = await encodeMessage(
      msg({
        from: { name: "Alice", address: "a@b.com" },
        to: ["a@b.com", "c@d.com"],
      }),
    );
    expect(result).toContain("From: Alice <a@b.com>");
    expect(result).toContain("To: a@b.com, c@d.com");
  });

  it("produces text/plain for text-only", async () => {
    const result = await encodeMessage(msg({ text: "Plain", html: undefined }));
    expect(result).toContain('Content-Type: text/plain; charset="UTF-8"');
    expect(result).toContain("Content-Transfer-Encoding: 7bit");
  });

  it("produces text/html for html-only", async () => {
    const result = await encodeMessage(msg());
    expect(result).toContain('Content-Type: text/html; charset="UTF-8"');
    expect(result).toContain("Content-Transfer-Encoding: quoted-printable");
  });

  it("wraps text+html in multipart/alternative", async () => {
    const result = await encodeMessage(
      msg({ text: "Plain", html: "<p>Rich</p>" }),
    );
    expect(result).toContain("multipart/alternative");
    expect(result).toContain("text/plain");
    expect(result).toContain("text/html");
  });

  it("wraps attachments in multipart/mixed", async () => {
    const result = await encodeMessage(
      msg({
        attachments: [{ filename: "test.txt", content: Buffer.from("hello") }],
      }),
    );
    expect(result).toContain("multipart/mixed");
    expect(result).toContain('Content-Disposition: attachment; filename="test.txt"');
  });

  it("handles inline cid attachments", async () => {
    const result = await encodeMessage(
      msg({
        attachments: [{ filename: "logo.png", content: Buffer.from("png"), cid: "logo" }],
      }),
    );
    expect(result).toContain("Content-Disposition: inline");
    expect(result).toContain("Content-ID: <logo>");
  });

  it("handles ReadableStream attachments", async () => {
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("stream data"));
        controller.close();
      },
    });
    const result = await encodeMessage(
      msg({ attachments: [{ filename: "s.txt", content: stream }] }),
    );
    expect(result).toContain("multipart/mixed");
  });

  it("uses CRLF line endings", async () => {
    const result = await encodeMessage(msg());
    expect(result.split("\r\n").length).toBeGreaterThan(1);
  });
});
