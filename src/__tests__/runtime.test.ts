import { describe, it, expect } from "vitest";
import { detectRuntime, supportsNodeModules, supportsFetch, supportsCrypto } from "../runtime.js";

describe("runtime detection", () => {
  it("detectRuntime returns a valid runtime", () => {
    const runtime = detectRuntime();
    expect(["node", "bun", "deno", "workerd", "edge", "unknown"]).toContain(runtime);
  });

  it("detects node in Node.js environment", () => {
    expect(detectRuntime()).toBe("node");
  });

  it("supportsNodeModules returns true in Node.js", () => {
    expect(supportsNodeModules()).toBe(true);
  });

  it("supportsFetch returns true in Node.js 18+", () => {
    expect(supportsFetch()).toBe(true);
  });

  it("supportsCrypto returns true in Node.js 18+", () => {
    expect(supportsCrypto()).toBe(true);
  });
});
