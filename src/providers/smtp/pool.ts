import type { SmtpTransportOptions } from "./types.js";
import { SmtpConnection } from "./connection.js";
import { createSendError } from "../../transport.js";

export interface SmtpPoolOptions extends SmtpTransportOptions {
  maxConnections?: number;
  idleTimeout?: number;
}

interface PooledConnection {
  connection: SmtpConnection;
  inUse: boolean;
  lastUsed: number;
  alive: boolean;
}

export class SmtpPool {
  private options: SmtpPoolOptions;
  private pool: PooledConnection[] = [];
  private waitQueue: Array<{
    resolve: (conn: SmtpConnection) => void;
    reject: (err: Error) => void;
  }> = [];
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private destroyed = false;

  constructor(options: SmtpPoolOptions) {
    this.options = {
      maxConnections: 5,
      idleTimeout: 60_000,
      ...options,
    };
    this.cleanupTimer = setInterval(() => this.cleanup(), 10_000);
  }

  private async createConnection(): Promise<PooledConnection> {
    const connection = new SmtpConnection(this.options);
    const greeting = await connection.connect();

    if (greeting.code !== 220) {
      connection.destroy();
      throw createSendError(
        `SMTP server rejected connection: ${greeting.lines.join(", ")}`,
        "smtp",
        { code: "CONNECTION_REJECTED", retryable: true },
      );
    }

    const hostname = this.options.host;
    await connection.sendCommand(`EHLO ${hostname}`, [250]);

    if (!this.options.secure) {
      try {
        const ehloResponse = await connection.sendCommand(
          `EHLO ${hostname}`,
          [250],
        );
        const supportsStarttls = ehloResponse.lines.some((line) =>
          line.toUpperCase().includes("STARTTLS"),
        );

        if (supportsStarttls) {
          await connection.sendCommand("STARTTLS", [220]);
          await connection.upgradeToTLS();
          await connection.sendCommand(`EHLO ${hostname}`, [250]);
        }
      } catch {
        // STARTTLS not available, continue unencrypted
      }
    }

    if (this.options.auth) {
      const authResponse = await connection.sendCommand("EHLO", [250]);
      const supportsAuth = authResponse.lines.some((line) =>
        line.toUpperCase().includes("AUTH"),
      );

      if (supportsAuth) {
        const { authenticate } = await import("./auth.js");
        await authenticate(connection, this.options.auth);
      }
    }

    const pooled: PooledConnection = {
      connection,
      inUse: false,
      lastUsed: Date.now(),
      alive: true,
    };

    pooled.connection["socket"]?.on("close", () => {
      pooled.alive = false;
    });

    return pooled;
  }

  private cleanup(): void {
    if (this.destroyed) return;

    const now = Date.now();
    const idleTimeout = this.options.idleTimeout!;

    for (let i = this.pool.length - 1; i >= 0; i--) {
      const pooled = this.pool[i];
      if (pooled && !pooled.inUse && (!pooled.alive || now - pooled.lastUsed > idleTimeout)) {
        pooled.connection.destroy();
        this.pool.splice(i, 1);
      }
    }

    if (this.pool.length === 0 && this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  async acquire(): Promise<SmtpConnection> {
    if (this.destroyed) {
      throw createSendError("SMTP pool has been destroyed", "smtp", {
        code: "POOL_DESTROYED",
      });
    }

    // Find an idle, alive connection
    for (const pooled of this.pool) {
      if (!pooled.inUse && pooled.alive) {
        pooled.inUse = true;
        pooled.lastUsed = Date.now();
        return pooled.connection;
      }
    }

    // Create a new one if under limit
    if (this.pool.length < this.options.maxConnections!) {
      const pooled = await this.createConnection();
      pooled.inUse = true;
      this.pool.push(pooled);
      return pooled.connection;
    }

    // Wait for one to become available
    return new Promise<SmtpConnection>((resolve, reject) => {
      this.waitQueue.push({ resolve, reject });
    });
  }

  release(connection: SmtpConnection): void {
    const pooled = this.pool.find((p) => p.connection === connection);
    if (!pooled) return;

    if (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      pooled.inUse = true;
      pooled.lastUsed = Date.now();
      waiter.resolve(connection);
      return;
    }

    pooled.inUse = false;
    pooled.lastUsed = Date.now();
  }

  markDead(connection: SmtpConnection): void {
    const pooled = this.pool.find((p) => p.connection === connection);
    if (pooled) {
      pooled.alive = false;
      pooled.connection.destroy();
    }

    // Wake up waiters with new connections
    this.waitForAvailable();
  }

  private async waitForAvailable(): Promise<void> {
    while (this.waitQueue.length > 0) {
      const waiter = this.waitQueue.shift()!;
      try {
        const conn = await this.acquire();
        waiter.resolve(conn);
      } catch (err) {
        waiter.reject(err as Error);
      }
    }
  }

  async destroy(): Promise<void> {
    this.destroyed = true;
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
    for (const pooled of this.pool) {
      pooled.connection.destroy();
    }
    this.pool = [];

    for (const waiter of this.waitQueue) {
      waiter.reject(
        createSendError("SMTP pool has been destroyed", "smtp", {
          code: "POOL_DESTROYED",
        }),
      );
    }
    this.waitQueue = [];
  }

  get size(): number {
    return this.pool.length;
  }

  get available(): number {
    return this.pool.filter((p) => !p.inUse && p.alive).length;
  }
}
