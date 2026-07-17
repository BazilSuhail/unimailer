import type { SmtpAuth } from "./types.js";
import type { SmtpConnection } from "./connection.js";
import { createSendError } from "../../transport.js";

export async function authenticate(
  connection: SmtpConnection,
  auth: SmtpAuth,
): Promise<void> {
  switch (auth.type) {
    case "plain":
      await authPlain(connection, auth.user, auth.pass);
      break;
    case "login":
      await authLogin(connection, auth.user, auth.pass);
      break;
    case "oauth2":
      await authOAuth2(
        connection,
        auth.user,
        auth.clientId,
        auth.clientSecret,
        auth.refreshToken,
      );
      break;
    default:
      throw createSendError(`Unsupported auth type: ${(auth as SmtpAuth).type}`, "smtp", {
        code: "AUTH_ERROR",
        retryable: false,
      });
  }
}

async function authPlain(
  connection: SmtpConnection,
  user: string,
  pass: string,
): Promise<void> {
  const authString = Buffer.from(`\0${user}\0${pass}`).toString("base64");
  const response = await connection.sendCommand(`AUTH PLAIN ${authString}`, [
    235,
    530,
  ]);

  if (response.code === 530) {
    throw createSendError("SMTP authentication required", "smtp", {
      code: "AUTH_REQUIRED",
      retryable: false,
    });
  }
}

async function authLogin(
  connection: SmtpConnection,
  user: string,
  pass: string,
): Promise<void> {
  await connection.sendCommand("AUTH LOGIN", [334]);
  await connection.sendCommand(
    Buffer.from(user).toString("base64"),
    [334],
  );
  await connection.sendCommand(
    Buffer.from(pass).toString("base64"),
    [235],
  );
}

async function authOAuth2(
  connection: SmtpConnection,
  user: string,
  _clientId: string,
  _clientSecret: string,
  refreshToken: string,
): Promise<void> {
  const authString = Buffer.from(
    `user=${user}\x01auth=Bearer ${refreshToken}\x01\x01`,
  ).toString("base64");

  await connection.sendCommand(`AUTH XOAUTH2 ${authString}`, [235, 530]);
}
