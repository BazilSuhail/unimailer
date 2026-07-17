import type {
  Transport,
  EmailMessage,
  SendResult,
} from "../../types.js";
import { createSendError } from "../../transport.js";
import { encodeMessage } from "../../mime.js";
import { SmtpConnection } from "./connection.js";
import { SmtpPool, type SmtpPoolOptions } from "./pool.js";
import { authenticate } from "./auth.js";
import type { SmtpTransportOptions } from "./types.js";
import { foldAddress, foldRecipients } from "../../utils.js";
import { signMessage, type DkimOptions } from "../../dkim.js";

export type { SmtpTransportOptions } from "./types.js";
export { SmtpPool } from "./pool.js";
export type { SmtpPoolOptions } from "./pool.js";

function generateMessageId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "";
  for (let i = 0; i < 24; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return `<${id}@unimailer>`;
}

async function sendViaConnection(
  connection: SmtpConnection,
  message: EmailMessage,
  transportId: string,
  dkimOptions?: DkimOptions,
): Promise<SendResult> {
  const messageId = generateMessageId();
  const fromAddr = foldAddress(message.from);
  const toAddrs = foldRecipients(message.to);

  await connection.sendCommand(`MAIL FROM:<${fromAddr}>`, [250]);

  for (const addr of toAddrs) {
    await connection.sendCommand(`RCPT TO:<${addr}>`, [250, 251]);
  }

  if (message.cc) {
    for (const addr of foldRecipients(message.cc)) {
      await connection.sendCommand(`RCPT TO:<${addr}>`, [250, 251]);
    }
  }

  if (message.bcc) {
    for (const addr of foldRecipients(message.bcc)) {
      await connection.sendCommand(`RCPT TO:<${addr}>`, [250, 251]);
    }
  }

  await connection.sendCommand("DATA", [354]);

  const rawMessage = await encodeMessage({
    ...message,
    headers: {
      "Message-ID": messageId,
      ...message.headers,
    },
  });

  const headerEnd = rawMessage.indexOf(`\r\n\r\n`);
  const headers = headerEnd === -1 ? rawMessage : rawMessage.slice(0, headerEnd);
  const body = headerEnd === -1 ? "" : rawMessage.slice(headerEnd + 4);
  const escapedBody = body.replace(/^\./gm, "..");
  let escapedMessage: string;
  if (dkimOptions) {
    escapedMessage = await signMessage(`${headers}\r\n\r\n${escapedBody}`, dkimOptions);
  } else {
    escapedMessage = `${headers}\r\n\r\n${escapedBody}`;
  }
  await connection.sendCommand(`${escapedMessage}\n.`, [250]);

  return {
    messageId,
    transportId,
    timestamp: new Date(),
  };
}

export class SmtpTransport implements Transport {
  readonly id = "smtp";
  private options: SmtpTransportOptions;
  private pool: SmtpPool | null = null;

  constructor(options: SmtpTransportOptions) {
    this.options = {
      port: 587,
      secure: false,
      connectionTimeout: 10000,
      socketTimeout: 30000,
      ...options,
    };

    if (this.options.pool?.enabled) {
      const poolOptions: SmtpPoolOptions = {
        ...this.options,
        maxConnections: this.options.pool.maxConnections,
        idleTimeout: this.options.pool.idleTimeout,
      };
      this.pool = new SmtpPool(poolOptions);
    }
  }

  async send(message: EmailMessage): Promise<SendResult> {
    if (this.pool) {
      return this.sendPooled(message);
    }
    return this.sendSingle(message);
  }

  private async sendPooled(message: EmailMessage): Promise<SendResult> {
    const connection = await this.pool!.acquire();
    try {
      return await sendViaConnection(connection, message, this.id, this.options.dkim);
    } catch (err) {
      if (err instanceof Error && "code" in err) {
        const sendErr = err as { retryable?: boolean };
        if (sendErr.retryable) {
          this.pool!.markDead(connection);
        } else {
          this.pool!.release(connection);
        }
      } else {
        this.pool!.markDead(connection);
      }
      throw err;
    } finally {
      this.pool!.release(connection);
    }
  }

  private async sendSingle(message: EmailMessage): Promise<SendResult> {
    const connection = new SmtpConnection(this.options);

    try {
      const greeting = await connection.connect();

      if (greeting.code !== 220) {
        throw createSendError(
          `SMTP server rejected connection: ${greeting.lines.join(", ")}`,
          this.id,
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
          await authenticate(connection, this.options.auth);
        }
      }

      const result = await sendViaConnection(connection, message, this.id, this.options.dkim);

      await connection.sendCommand("QUIT", [220, 221, 250]);

      return result;
    } catch (err) {
      if (err instanceof Error && "code" in err) throw err;
      throw createSendError(
        err instanceof Error ? err.message : String(err),
        this.id,
        { code: "SMTP_ERROR", retryable: false, cause: err as Error },
      );
    } finally {
      connection.destroy();
    }
  }

  async destroy(): Promise<void> {
    if (this.pool) {
      await this.pool.destroy();
      this.pool = null;
    }
  }
}
