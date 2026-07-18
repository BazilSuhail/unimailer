export type Runtime = "node" | "bun" | "deno" | "workerd" | "edge" | "unknown";

const g = globalThis as Record<string, unknown>;

export function detectRuntime(): Runtime {
  const proc = g.process as { versions?: { node?: string } } | undefined;
  if (proc?.versions?.node) {
    return "node";
  }

  if (g.Bun) {
    return "bun";
  }

  if (g.Deno) {
    return "deno";
  }

  if (typeof g.caches !== "undefined" && typeof g.navigator !== "undefined") {
    if (typeof g.DOMException !== "undefined") {
      return "workerd";
    }
    return "edge";
  }

  return "unknown";
}

export function supportsNodeModules(): boolean {
  return detectRuntime() === "node" || detectRuntime() === "bun";
}

export function supportsFetch(): boolean {
  return typeof globalThis.fetch === "function";
}

export function supportsCrypto(): boolean {
  return (
    typeof globalThis.crypto !== "undefined" &&
    typeof globalThis.crypto.subtle !== "undefined"
  );
}
