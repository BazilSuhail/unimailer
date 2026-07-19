import { describe, it, expect } from "vitest";
import { compile, compileMessage } from "../template.js";
import type { EmailMessage } from "../types.js";

describe("compile", () => {
  it("replaces simple variable", () => {
    expect(compile("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("replaces multiple variables", () => {
    const result = compile("{{greeting}} {{name}}!", { greeting: "Hi", name: "Bob" });
    expect(result).toBe("Hi Bob!");
  });

  it("uses default value for missing key", () => {
    expect(compile("Hello {{name}}!", {}, { defaultValue: "stranger" })).toBe("Hello stranger!");
  });

  it("returns empty string for missing key without default", () => {
    expect(compile("Hello {{name}}!", {})).toBe("Hello !");
  });

  it("handles number values", () => {
    expect(compile("Count: {{n}}", { n: 42 })).toBe("Count: 42");
  });

  it("handles boolean values", () => {
    expect(compile("Active: {{active}}", { active: true })).toBe("Active: true");
  });

  it("handles null as missing", () => {
    expect(compile("Value: {{x}}", { x: null })).toBe("Value: ");
  });

  it("handles nested dot notation", () => {
    const data: Record<string, unknown> = { user: { name: "Alice" } };
    expect(compile("Hello {{user.name}}!", data as any)).toBe("Hello Alice!");
  });

  it("handles custom delimiters", () => {
    const result = compile("Hello [[name]]!", { name: "World" }, {
      openDelimiter: "[[",
      closeDelimiter: "]]",
    });
    expect(result).toBe("Hello World!");
  });

  it("leaves unmatched delimiters untouched", () => {
    expect(compile("Hello {{name}} and {{missing}}!", { name: "X" })).toBe("Hello X and !");
  });
});

describe("compileMessage", () => {
  const baseMsg: EmailMessage = {
    from: "a@b.com",
    to: "c@d.com",
    subject: "Hello {{name}}",
    html: "<p>Welcome {{name}}!</p>",
    text: "Welcome {{name}}!",
  };

  it("compiles subject, html, and text", () => {
    const result = compileMessage(baseMsg, { name: "Alice" });
    expect(result.subject).toBe("Hello Alice");
    expect(result.html).toBe("<p>Welcome Alice!</p>");
    expect(result.text).toBe("Welcome Alice!");
  });

  it("does not modify from/to", () => {
    const result = compileMessage(baseMsg, { name: "Alice" });
    expect(result.from).toBe("a@b.com");
    expect(result.to).toBe("c@d.com");
  });

  it("leaves messages without template vars unchanged", () => {
    const msg: EmailMessage = {
      from: "a@b.com",
      to: "c@d.com",
      subject: "No vars",
      html: "<p>Plain</p>",
    };
    const result = compileMessage(msg, { name: "Alice" });
    expect(result.subject).toBe("No vars");
    expect(result.html).toBe("<p>Plain</p>");
  });
});
