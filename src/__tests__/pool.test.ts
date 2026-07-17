import { describe, it, expect, vi } from "vitest";
import { SmtpPool } from "../providers/smtp/pool.js";

vi.mock("node:net", () => ({
  createConnection: vi.fn(() => ({
    setEncoding: vi.fn(),
    write: vi.fn(),
    destroy: vi.fn(),
    destroyed: false,
    on: vi.fn(),
    removeListener: vi.fn(),
  })),
}));

vi.mock("node:tls", () => ({
  connect: vi.fn(),
}));

const POOL_OPTIONS = {
  host: "smtp.test.com",
  port: 587,
  secure: false,
  connectionTimeout: 5000,
  socketTimeout: 5000,
  maxConnections: 3,
  idleTimeout: 60_000,
};

describe("SmtpPool", () => {
  it("creates pool with default options", () => {
    const pool = new SmtpPool({ host: "smtp.test.com" });
    expect(pool.size).toBe(0);
    expect(pool.available).toBe(0);
  });

  it("tracks pool size", async () => {
    const pool = new SmtpPool(POOL_OPTIONS);
    // Without mocking the full SMTP handshake, pool stays at 0
    expect(pool.size).toBe(0);
    await pool.destroy();
  });

  it("destroy marks pool as destroyed", async () => {
    const pool = new SmtpPool(POOL_OPTIONS);
    await pool.destroy();
    await expect(pool.acquire()).rejects.toThrow("destroyed");
  });

  it("release after destroy is safe", async () => {
    const pool = new SmtpPool(POOL_OPTIONS);
    await pool.destroy();
    // Should not throw
    pool.release({ destroy: vi.fn() } as any);
  });

  it("markDead marks connection as dead and destroys it", async () => {
    const pool = new SmtpPool(POOL_OPTIONS);
    const mockConn = { destroy: vi.fn() } as any;
    (pool as any).pool = [
      { connection: mockConn, inUse: false, lastUsed: Date.now(), alive: true },
    ];
    pool.markDead(mockConn);
    expect(mockConn.destroy).toHaveBeenCalled();
    expect(pool.available).toBe(0);
    await pool.destroy();
  });
});
