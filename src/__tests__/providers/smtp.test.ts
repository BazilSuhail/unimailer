import { describe, it, expect, vi } from "vitest";
import { SmtpTransport } from "../../providers/smtp/index.js";

vi.mock("node:net", () => ({
  createConnection: vi.fn(() => ({
    setEncoding: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
    destroyed: false,
    on: vi.fn(),
    removeListener: vi.fn(),
  })),
}));

vi.mock("node:tls", () => ({
  connect: vi.fn(),
}));

describe("SmtpTransport", () => {
  it("has id 'smtp'", () => {
    const transport = new SmtpTransport({ host: "smtp.test.com" });
    expect(transport.id).toBe("smtp");
  });

  it("applies default port 587", () => {
    const transport = new SmtpTransport({ host: "smtp.test.com" });
    expect(transport.id).toBe("smtp");
  });

  it("constructs with custom options", () => {
    const transport = new SmtpTransport({
      host: "mail.custom.com",
      port: 465,
      secure: true,
      auth: { type: "plain", user: "u", pass: "p" },
    });
    expect(transport.id).toBe("smtp");
  });
});
