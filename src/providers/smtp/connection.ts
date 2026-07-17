import { createConnection, type Socket } from "node:net";
import { connect as tlsConnect, type TLSSocket } from "node:tls";
import type { SmtpTransportOptions, SmtpResponse } from "./types.js";
import { createSendError } from "../../transport.js";

const CRLF = "\r\n";

export class SmtpConnection {
  private socket: Socket | TLSSocket | null = null;
  private options: SmtpTransportOptions;
  private buffer = "";
  constructor(options: SmtpTransportOptions) {
    this.options = {
      port: 587,
      secure: false,
      connectionTimeout: 10000,
      socketTimeout: 30000,
      greetingTimeout: 10000,
      ...options,
    };
  }

  private createTimeoutError(phase: string): Error {
    return createSendError(`${phase} timed out`, "smtp", {
      code: "TIMEOUT",
      retryable: true,
    });
  }

  async connect(): Promise<SmtpResponse> {
    return new Promise<SmtpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(this.createTimeoutError("Connection"));
      }, this.options.connectionTimeout!);

      this.buffer = "";
      const port = this.options.port ?? 587;

      this.socket = createConnection({
        host: this.options.host,
        port,
      });

      this.socket.setEncoding("utf-8");

      this.socket.on("data", (data: string) => {
        this.buffer += data;
        if (this.buffer.includes("\n")) {
          const lines = this.buffer.split("\n");
          const lastLine = lines[lines.length - 1]!;
          this.buffer = lastLine;

          if (lastLine.trim() === "" || /^\d{3}\s/.test(lastLine)) {
            clearTimeout(timer);
            this.parseResponse(resolve, this.buffer);
          }
        }
      });

      this.socket.on("error", (err) => {
        clearTimeout(timer);
        reject(
          createSendError(
            `SMTP connection error: ${err.message}`,
            "smtp",
            { code: "CONNECTION_ERROR", retryable: true, cause: err },
          ),
        );
      });

      this.socket.on("timeout", () => {
        clearTimeout(timer);
        this.socket?.destroy();
        reject(this.createTimeoutError("Socket"));
      });

      this.socket.on("close", () => {
        this.socket = null;
      });
    });
  }

  private parseResponse(
    resolve: (response: SmtpResponse) => void,
    data: string,
  ): void {
    const lines = data.split(/\r?\n/).filter((l) => l.trim() !== "");
    if (lines.length === 0) return;

    const lastLine = lines[lines.length - 1]!;
    const code = parseInt(lastLine.slice(0, 3), 10);

    resolve({ code, lines });
  }

  async sendCommand(
    command: string,
    expectedCode: number | number[],
  ): Promise<SmtpResponse> {
    return new Promise<SmtpResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(this.createTimeoutError("Command"));
      }, this.options.socketTimeout!);

      this.buffer = "";

      const codes = Array.isArray(expectedCode)
        ? expectedCode
        : [expectedCode];

      const handler = (data: string) => {
        this.buffer += data;

        const lines = this.buffer.split(/\r?\n/).filter((l) => l.trim() !== "");
        const lastLine = lines[lines.length - 1] ?? "";

        if (lastLine.length >= 3 && /^\d{3}\s/.test(lastLine)) {
          this.socket?.removeListener("data", handler);
          clearTimeout(timer);

          const code = parseInt(lastLine.slice(0, 3), 10);
          const response = { code, lines };

          if (codes.includes(code)) {
            resolve(response);
          } else {
            reject(
              createSendError(
                `SMTP unexpected response ${code}: ${lastLine}`,
                "smtp",
                {
                  code: "SMTP_ERROR",
                  statusCode: code,
                  retryable: code >= 400 && code < 500,
                },
              ),
            );
          }
        }
      };

      this.socket?.on("data", handler);
      this.socket?.write(command + CRLF);
    });
  }

  async upgradeToTLS(): Promise<void> {
    return new Promise((resolve, reject) => {
      const plainSocket = this.socket as Socket;

      const tlsSocket = tlsConnect(
        {
          socket: plainSocket,
          servername: this.options.host,
          rejectUnauthorized: this.options.tls?.rejectUnauthorized ?? true,
          minVersion: "TLSv1.2",
        },
        () => {
          this.socket = tlsSocket;
          resolve();
        },
      );

      tlsSocket.on("error", (err) => {
        reject(
          createSendError(`TLS upgrade failed: ${err.message}`, "smtp", {
            code: "TLS_ERROR",
            retryable: false,
            cause: err,
          }),
        );
      });
    });
  }

  destroy(): void {
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  get isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }
}
