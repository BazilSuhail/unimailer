import { describe, it, expect } from "vitest";
import { validateMessage } from "../validation.js";

describe("validateMessage", () => {
  const valid = () => ({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Test",
    html: "<p>Hello</p>",
  });

  it("accepts minimal valid message", () => {
    expect(validateMessage(valid())).toBeDefined();
  });

  it("accepts text-only message", () => {
    expect(
      validateMessage({ ...valid(), text: "Hello", html: undefined }),
    ).toBeDefined();
  });

  it("accepts from as name+address object", () => {
    expect(
      validateMessage({
        ...valid(),
        from: { name: "Alice", address: "alice@example.com" },
      }),
    ).toBeDefined();
  });

  it("accepts to as array", () => {
    expect(
      validateMessage({
        ...valid(),
        to: ["a@example.com", "b@example.com"],
      }),
    ).toBeDefined();
  });

  it("accepts to as name+address object", () => {
    expect(
      validateMessage({
        ...valid(),
        to: { name: "Bob", address: "bob@example.com" },
      }),
    ).toBeDefined();
  });

  it("accepts all optional fields", () => {
    expect(
      validateMessage({
        from: "sender@example.com",
        to: "recipient@example.com",
        cc: "cc@example.com",
        bcc: "bcc@example.com",
        replyTo: "reply@example.com",
        subject: "Full",
        html: "<p>Hi</p>",
        text: "Hi",
        headers: { "X-Custom": "value" },
        attachments: [{ filename: "test.txt", content: "data" }],
      }),
    ).toBeDefined();
  });

  it("rejects non-object input", () => {
    expect(() => validateMessage(null)).toThrow("must be an object");
    expect(() => validateMessage("string")).toThrow("must be an object");
  });

  it("rejects missing from", () => {
    expect(() =>
      validateMessage({ to: "a@b.com", subject: "T", html: "<p>x</p>" }),
    ).toThrow("from");
  });

  it("rejects invalid from email", () => {
    expect(() =>
      validateMessage({ ...valid(), from: "not-an-email" }),
    ).toThrow("from");
  });

  it("rejects missing to", () => {
    expect(() =>
      validateMessage({ from: "a@b.com", subject: "T", html: "<p>x</p>" }),
    ).toThrow("to");
  });

  it("rejects empty to array", () => {
    expect(() =>
      validateMessage({ ...valid(), to: [] }),
    ).toThrow("to");
  });

  it("rejects invalid to email", () => {
    expect(() =>
      validateMessage({ ...valid(), to: "bad" }),
    ).toThrow("to");
  });

  it("rejects missing subject", () => {
    expect(() =>
      validateMessage({ from: "a@b.com", to: "c@d.com", html: "<p>x</p>" }),
    ).toThrow("subject");
  });

  it("rejects empty subject", () => {
    expect(() =>
      validateMessage({ ...valid(), subject: "   " }),
    ).toThrow("subject");
  });

  it("rejects no text and no html", () => {
    expect(() =>
      validateMessage({ from: "a@b.com", to: "c@d.com", subject: "T" }),
    ).toThrow("Email must have either");
  });

  it("rejects invalid cc", () => {
    expect(() =>
      validateMessage({ ...valid(), cc: "not-email" }),
    ).toThrow("cc");
  });

  it("rejects invalid bcc", () => {
    expect(() =>
      validateMessage({ ...valid(), bcc: ["valid@e.com", "bad"] }),
    ).toThrow("bcc");
  });

  it("rejects invalid replyTo", () => {
    expect(() =>
      validateMessage({ ...valid(), replyTo: "bad" }),
    ).toThrow("replyTo");
  });

  it("rejects non-array attachments", () => {
    expect(() =>
      validateMessage({ ...valid(), attachments: "file.txt" }),
    ).toThrow("attachments");
  });

  it("rejects attachment without filename", () => {
    expect(() =>
      validateMessage({ ...valid(), attachments: [{ content: "data" }] }),
    ).toThrow("filename");
  });
});
