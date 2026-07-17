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
  it("starts with the correct prefix", () => {
    expect(generateBoundary()).toMatch(/^----=_UniMailer_/);
  });

  it("returns 36 random chars after prefix", () => {
    const b = generateBoundary();
    expect(b.replace("----=_UniMailer_", "")).toHaveLength(36);
  });

  it("generates unique values", () => {
    const a = generateBoundary();
    const b = generateBoundary();
    expect(a).not.toBe(b);
  });
});

describe("CRLF", () => {
  it("is \\r\\n", () => {
    expect(CRLF).toBe("\r\n");
  });
});

describe("foldAddress", () => {
  it("returns string as-is", () => {
    expect(foldAddress("test@example.com")).toBe("test@example.com");
  });

  it("formats name + address object", () => {
    expect(
      foldAddress({ name: "Alice", address: "alice@example.com" }),
    ).toBe("Alice <alice@example.com>");
  });
});

describe("foldRecipients", () => {
  it("wraps single string in array", () => {
    expect(foldRecipients("a@b.com")).toEqual(["a@b.com"]);
  });

  it("wraps single object in array", () => {
    expect(
      foldRecipients({ name: "B", address: "b@b.com" }),
    ).toEqual(["B <b@b.com>"]);
  });

  it("maps array of strings", () => {
    expect(foldRecipients(["a@b.com", "c@d.com"])).toEqual([
      "a@b.com",
      "c@d.com",
    ]);
  });

  it("maps array of objects", () => {
    expect(
      foldRecipients([
        { name: "A", address: "a@b.com" },
        "c@d.com",
      ]),
    ).toEqual(["A <a@b.com>", "c@d.com"]);
  });
});

describe("encodeBase64Lines", () => {
  it("encodes buffer to base64", () => {
    const buf = Buffer.from("Hello World");
    expect(encodeBase64Lines(buf)).toBe("SGVsbG8gV29ybGQ=");
  });

  it("splits long base64 into 76-char lines", () => {
    const data = Buffer.alloc(200, 0x41);
    const result = encodeBase64Lines(data);
    const lines = result.split(CRLF);
    for (const line of lines) {
      expect(line.length).toBeLessThanOrEqual(76);
    }
  });
});

describe("guessMimeType", () => {
  it("returns correct types for common extensions", () => {
    expect(guessMimeType("file.pdf")).toBe("application/pdf");
    expect(guessMimeType("image.png")).toBe("image/png");
    expect(guessMimeType("photo.jpg")).toBe("image/jpeg");
    expect(guessMimeType("style.css")).toBe("text/css");
    expect(guessMimeType("data.json")).toBe("application/json");
    expect(guessMimeType("archive.zip")).toBe("application/zip");
    expect(guessMimeType("calendar.ics")).toBe("text/calendar");
  });

  it("returns octet-stream for unknown extensions", () => {
    expect(guessMimeType("file.xyz")).toBe("application/octet-stream");
  });

  it("handles case insensitivity", () => {
    expect(guessMimeType("FILE.PDF")).toBe("application/pdf");
    expect(guessMimeType("image.PNG")).toBe("image/png");
  });
});
