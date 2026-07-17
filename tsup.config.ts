import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ["node:net", "node:tls", "node:events", "node:buffer", "node:stream"],
  },
  {
    entry: ["src/providers/smtp/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist/providers/smtp",
    sourcemap: true,
    external: ["node:net", "node:tls", "node:events", "node:buffer", "node:stream"],
  },
  {
    entry: ["src/providers/resend/index.ts"],
    format: ["esm", "cjs"],
    dts: true,
    outDir: "dist/providers/resend",
    sourcemap: true,
  },
]);
