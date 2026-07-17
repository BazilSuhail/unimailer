import type { Transport, SendResult, EmailMessage, SendError } from "./types.js";
import { createSendError } from "./transport.js";

export class FailoverMailer implements Transport {
  readonly id = "failover";
  private transports: Transport[];

  constructor(transports: Transport[]) {
    if (transports.length === 0) {
      throw new Error("FailoverMailer requires at least one transport");
    }
    this.transports = transports;
  }

  async send(email: EmailMessage): Promise<SendResult> {
    const errors: SendError[] = [];

    for (const transport of this.transports) {
      try {
        return await transport.send(email);
      } catch (err) {
        const sendError =
          err instanceof Error && "code" in err
            ? (err as SendError)
            : createSendError(String(err), transport.id, { cause: err as Error });

        errors.push(sendError);
      }
    }

    const summary = `All ${this.transports.length} transports failed`;
    const details = errors
      .map((e) => `[${e.transportId}] ${e.message}`)
      .join("\n");

    throw createSendError(`${summary}:\n${details}`, this.id, {
      code: "FAILOVER_EXHAUSTED",
    });
  }
}
