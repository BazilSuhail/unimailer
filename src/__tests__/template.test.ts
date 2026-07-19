import { describe, it, expect } from "vitest";
import { compile, compileMessage } from "../template.js";

describe("compile", () => {
  it("replaces simple variable", () => {
    expect(compile("Hello {{name}}!", { name: "World" })).toBe("Hello World!");
  });

  it("uses default value for missing key", () => {
    expect(compile("Hi {{x}}!", {}, { defaultValue: "?" })).toBe("Hi ?!");
  });

  it("handles nested dot notation", () => {
    const data: Record<string, unknown> = { user: { name: "Alice" } };
    expect(compile("{{user.name}}", data as any)).toBe("Alice");
  });

  it("handles custom delimiters", () => {
    expect(compile("Hi [[n]]!", { n: "X" }, { openDelimiter: "[[", closeDelimiter: "]]" }))
      .toBe("Hi X!");
  });
});

describe("compileMessage", () => {
  it("compiles subject, html, and text", () => {
    const msg = {
      from: "a@b.com", to: "c@d.com",
      subject: "Hi {{name}}", html: "<p>{{name}}</p>", text: "{{name}}",
    };
    const result = compileMessage(msg as any, { name: "Bob" });
    expect(result.subject).toBe("Hi Bob");
    expect(result.html).toBe("<p>Bob</p>");
    expect(result.text).toBe("Bob");
  });

  it("preserves from and to", () => {
    const msg = { from: "a@b.com", to: "c@d.com", subject: "S", html: "<p>x</p>" };
    const result = compileMessage(msg, { x: "y" });
    expect(result.from).toBe("a@b.com");
    expect(result.to).toBe("c@d.com");
  });
});
