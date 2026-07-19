import { describe, it, expect } from "vitest";
import {
  generateBoundary,
  CRLF,
  foldAddress,
  foldRecipients,
  encodeBase64Lines,
  guessMimeType,
} from "../utils.js";

describe("generateBoundary", () => {
  it("starts with expected prefix", () => {
    expect(generateBoundary()).toMatch(/^----=_UniMailer_/);
  });

  it("returns unique values", () => {
    const a = generateBoundary();
    const b = generateBoundary();
    expect(a).not.toBe(b);
  });
});

describe("foldAddress", () => {
  it("returns plain email as-is", () => {
    expect(foldAddress("a@b.com")).toBe("a@b.com");
  });

  it("formats name+address", () => {
    expect(foldAddress({ name: "Alice", address: "a@b.com" })).toBe(
      "Alice <a@b.com>",
    );
  });
});

describe("foldRecipients", () => {
  it("wraps single recipient into array", () => {
    expect(foldRecipients("a@b.com")).toEqual(["a@b.com"]);
  });

  it("passes through array", () => {
    expect(foldRecipients(["a@b.com", { name: "B", address: "c@d.com" }])).toEqual([
      "a@b.com",
      "B <c@d.com>",
    ]);
  });
});

describe("encodeBase64Lines", () => {
  it("splits base64 into 76-char lines", () => {
    const data = new TextEncoder().encode("a".repeat(100));
    const result = encodeBase64Lines(data);
    const lines = result.split(CRLF);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });
});

describe("guessMimeType", () => {
  it("returns known types", () => {
    expect(guessMimeType("file.pdf")).toBe("application/pdf");
    expect(guessMimeType("image.png")).toBe("image/png");
    expect(guessMimeType("style.css")).toBe("text/css");
  });

  it("returns octet-stream for unknown", () => {
    expect(guessMimeType("file.xyz")).toBe("application/octet-stream");
  });
});
