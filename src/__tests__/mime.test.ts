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
  describe("headers", () => {
    it("includes MIME-Version: 1.0", () => {
      const result = encodeMessage(msg());
      expect(result).toContain("MIME-Version: 1.0");
    });

    it("includes From header", () => {
      const result = encodeMessage(msg());
      expect(result).toContain("From: sender@example.com");
    });

    it("includes To header", () => {
      const result = encodeMessage(msg());
      expect(result).toContain("To: recipient@example.com");
    });

    it("includes Subject header", () => {
      const result = encodeMessage(msg());
      expect(result).toContain("Subject: Test Subject");
    });

    it("includes Date header", () => {
      const result = encodeMessage(msg());
      expect(result).toMatch(/Date: /);
    });

    it("includes custom headers", () => {
      const result = encodeMessage(
        msg({ headers: { "X-Campaign": "summer" } }),
      );
      expect(result).toContain("X-Campaign: summer");
    });

    it("includes Reply-To header", () => {
      const result = encodeMessage(
        msg({ replyTo: "reply@example.com" }),
      );
      expect(result).toContain("Reply-To: reply@example.com");
    });

    it("includes Cc header", () => {
      const result = encodeMessage(msg({ cc: "cc@example.com" }));
      expect(result).toContain("Cc: cc@example.com");
    });

    it("includes Bcc header", () => {
      const result = encodeMessage(msg({ bcc: "bcc@example.com" }));
      expect(result).toContain("Bcc: bcc@example.com");
    });

    it("formats from as name+address", () => {
      const result = encodeMessage(
        msg({ from: { name: "Alice", address: "a@b.com" } }),
      );
      expect(result).toContain("From: Alice <a@b.com>");
    });

    it("formats to as array", () => {
      const result = encodeMessage(
        msg({ to: ["a@b.com", "c@d.com"] }),
      );
      expect(result).toContain("To: a@b.com, c@d.com");
    });
  });

  describe("text-only", () => {
    it("produces text/plain content type", () => {
      const result = encodeMessage(msg({ text: "Plain text", html: undefined }));
      expect(result).toContain('Content-Type: text/plain; charset="UTF-8"');
      expect(result).toContain("Content-Transfer-Encoding: 7bit");
      expect(result).toContain("Plain text");
    });
  });

  describe("html-only", () => {
    it("produces text/html content type", () => {
      const result = encodeMessage(msg());
      expect(result).toContain('Content-Type: text/html; charset="UTF-8"');
      expect(result).toContain("Content-Transfer-Encoding: quoted-printable");
      expect(result).toContain("<p>Hello</p>");
    });
  });

  describe("text + html (multipart/alternative)", () => {
    it("wraps in multipart/alternative", () => {
      const result = encodeMessage(
        msg({ text: "Plain", html: "<p>Rich</p>" }),
      );
      expect(result).toContain("multipart/alternative");
      expect(result).toContain("text/plain");
      expect(result).toContain("text/html");
    });

    it("text part comes before html part", () => {
      const result = encodeMessage(
        msg({ text: "Plain", html: "<p>Rich</p>" }),
      );
      const textIdx = result.indexOf("text/plain");
      const htmlIdx = result.indexOf("text/html");
      expect(textIdx).toBeLessThan(htmlIdx);
    });
  });

  describe("attachments (multipart/mixed)", () => {
    it("wraps in multipart/mixed when attachments present", () => {
      const result = encodeMessage(
        msg({
          attachments: [
            { filename: "test.txt", content: Buffer.from("hello") },
          ],
        }),
      );
      expect(result).toContain("multipart/mixed");
    });

    it("includes attachment headers", () => {
      const result = encodeMessage(
        msg({
          attachments: [
            { filename: "test.txt", content: Buffer.from("hello") },
          ],
        }),
      );
      expect(result).toContain("Content-Transfer-Encoding: base64");
      expect(result).toContain('Content-Disposition: attachment; filename="test.txt"');
    });

    it("uses custom contentType when provided", () => {
      const result = encodeMessage(
        msg({
          attachments: [
            {
              filename: "data.bin",
              content: Buffer.from("x"),
              contentType: "application/octet-stream",
            },
          ],
        }),
      );
      expect(result).toContain("Content-Type: application/octet-stream");
    });

    it("uses inline disposition for cid attachments", () => {
      const result = encodeMessage(
        msg({
          attachments: [
            {
              filename: "logo.png",
              content: Buffer.from("png"),
              cid: "logo",
            },
          ],
        }),
      );
      expect(result).toContain("Content-Disposition: inline");
      expect(result).toContain("Content-ID: <logo>");
    });

    it("text + html + attachments produces nested multipart", () => {
      const result = encodeMessage(
        msg({
          text: "Plain",
          html: "<p>Rich</p>",
          attachments: [
            { filename: "file.pdf", content: Buffer.from("pdf") },
          ],
        }),
      );
      expect(result).toContain("multipart/mixed");
      expect(result).toContain("multipart/alternative");
    });
  });

  describe("CRLF", () => {
    it("uses CRLF line endings throughout", () => {
      const result = encodeMessage(msg());
      const lines = result.split("\r\n");
      expect(lines.length).toBeGreaterThan(1);
    });
  });
});
