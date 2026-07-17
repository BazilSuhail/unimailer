import { describe, it, expect } from "vitest";
import { Mailer, createSendError } from "../transport.js";
import type { Transport } from "../types.js";

describe("Mailer", () => {
  it("delegates to transport.send", async () => {
    let received = false;
    const transport: Transport = {
      id: "test",
      async send(_msg) {
        received = true;
        return { messageId: "1", transportId: "test", timestamp: new Date() };
      },
    };

    const mailer = new Mailer(transport);
    await mailer.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    });

    expect(received).toBe(true);
  });

  it("validates message before sending", async () => {
    const transport: Transport = {
      id: "test",
      async send() {
        return { messageId: "1", transportId: "test", timestamp: new Date() };
      },
    };

    const mailer = new Mailer(transport);

    await expect(
      mailer.send({ from: "bad", to: "c@d.com", subject: "T", html: "<p>x</p>" }),
    ).rejects.toThrow("validation failed");
  });

  it("returns transport's result", async () => {
    const transport: Transport = {
      id: "test",
      async send() {
        return { messageId: "abc", transportId: "test", timestamp: new Date() };
      },
    };

    const mailer = new Mailer(transport);
    const result = await mailer.send({
      from: "a@b.com",
      to: "c@d.com",
      subject: "T",
      html: "<p>x</p>",
    });

    expect(result.messageId).toBe("abc");
  });
});

describe("createSendError", () => {
  it("creates error with defaults", () => {
    const err = createSendError("fail", "smtp");
    expect(err.message).toBe("fail");
    expect(err.code).toBe("SEND_FAILED");
    expect(err.transportId).toBe("smtp");
    expect(err.retryable).toBe(false);
    expect(err.statusCode).toBeUndefined();
  });

  it("accepts custom options", () => {
    const cause = new Error("original");
    const err = createSendError("fail", "resend", {
      code: "TIMEOUT",
      statusCode: 408,
      retryable: true,
      cause,
    });
    expect(err.code).toBe("TIMEOUT");
    expect(err.statusCode).toBe(408);
    expect(err.retryable).toBe(true);
    expect(err.cause).toBe(cause);
  });
});
