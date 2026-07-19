import { describe, it, expect, vi } from "vitest";
import { SmtpPool } from "../providers/smtp/pool.js";

vi.mock("node:net", () => ({
  createConnection: vi.fn(() => ({
    setEncoding: vi.fn(), write: vi.fn(), destroy: vi.fn(),
    destroyed: false, on: vi.fn(), removeListener: vi.fn(),
  })),
}));

vi.mock("node:tls", () => ({ connect: vi.fn() }));

const OPTS = { host: "smtp.test.com", port: 587, maxConnections: 3, idleTimeout: 60_000 };

describe("SmtpPool", () => {
  it("starts with size 0", () => {
    const pool = new SmtpPool(OPTS);
    expect(pool.size).toBe(0);
  });

  it("destroy marks pool as destroyed", async () => {
    const pool = new SmtpPool(OPTS);
    await pool.destroy();
    await expect(pool.acquire()).rejects.toThrow("destroyed");
  });

  it("markDead marks connection as dead", async () => {
    const pool = new SmtpPool(OPTS);
    const conn = { destroy: vi.fn() } as any;
    (pool as any).pool = [{ connection: conn, inUse: false, lastUsed: Date.now(), alive: true }];
    pool.markDead(conn);
    expect(conn.destroy).toHaveBeenCalled();
    expect(pool.available).toBe(0);
    await pool.destroy();
  });
});
