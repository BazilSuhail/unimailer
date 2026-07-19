import { describe, it, expect } from "vitest";
import { validateMessage } from "../validation.js";

const valid = {
  from: "a@b.com",
  to: "c@d.com",
  subject: "Hi",
  html: "<p>x</p>",
};

describe("validateMessage", () => {
  it("accepts minimal valid message", () => {
    expect(validateMessage(valid)).toEqual(valid);
  });

  it("accepts name+address from", () => {
    const msg = { ...valid, from: { name: "A", address: "a@b.com" } };
    expect(validateMessage(msg)).toEqual(msg);
  });

  it("accepts array to", () => {
    expect(validateMessage({ ...valid, to: ["a@b.com", "c@d.com"] })).toBeDefined();
  });

  it("accepts all optional fields", () => {
    const msg = {
      ...valid,
      cc: "cc@b.com",
      bcc: ["bcc@b.com"],
      replyTo: "r@b.com",
      text: "Plain",
      headers: { "X-Custom": "v" },
      attachments: [{ filename: "f.txt", content: "x" }],
    };
    expect(validateMessage(msg)).toBeDefined();
  });

  it("rejects non-object input", () => {
    expect(() => validateMessage(null)).toThrow("must be an object");
  });

  it("rejects missing from", () => {
    expect(() => validateMessage({ ...valid, from: undefined })).toThrow("from");
  });

  it("rejects invalid from", () => {
    expect(() => validateMessage({ ...valid, from: "not-email" })).toThrow("from");
  });

  it("rejects missing to", () => {
    expect(() => validateMessage({ ...valid, to: undefined })).toThrow("to");
  });

  it("rejects empty to array", () => {
    expect(() => validateMessage({ ...valid, to: [] })).toThrow("to");
  });

  it("rejects missing subject", () => {
    expect(() => validateMessage({ ...valid, subject: "" })).toThrow("subject");
  });

  it("rejects no text and no html", () => {
    expect(() => validateMessage({ ...valid, text: undefined, html: undefined })).toThrow(
      "Email must have either",
    );
  });

  it("rejects invalid cc", () => {
    expect(() => validateMessage({ ...valid, cc: "bad" })).toThrow("cc");
  });

  it("rejects invalid attachment", () => {
    expect(() =>
      validateMessage({ ...valid, attachments: [{ filename: "" }] }),
    ).toThrow("filename");
  });
});
