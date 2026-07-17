import type { EmailMessage, EmailRecipient } from "./types.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && EMAIL_RE.test(value);
}

function isValidRecipient(value: unknown): value is EmailRecipient {
  if (typeof value === "string") return EMAIL_RE.test(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return typeof obj.name === "string" && typeof obj.address === "string" && EMAIL_RE.test(obj.address);
  }
  return false;
}

function isValidAddress(
  value: unknown,
): value is string | { name: string; address: string } {
  if (typeof value === "string") return EMAIL_RE.test(value);
  if (value && typeof value === "object") {
    const obj = value as Record<string, unknown>;
    return typeof obj.name === "string" && typeof obj.address === "string" && EMAIL_RE.test(obj.address);
  }
  return false;
}

function toArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}

export function validateMessage(msg: unknown): EmailMessage {
  if (!msg || typeof msg !== "object") {
    throw new Error("Email message must be an object");
  }

  const m = msg as Record<string, unknown>;
  const errors: string[] = [];

  if (!isValidAddress(m.from)) {
    errors.push("from: must be a valid email address");
  }

  if (
    m.to === undefined ||
    m.to === null ||
    (typeof m.to !== "string" && !Array.isArray(m.to)) ||
    (Array.isArray(m.to) && m.to.length === 0) ||
    (typeof m.to === "string" && !isValidEmail(m.to)) ||
    (Array.isArray(m.to) && !m.to.every(isValidRecipient))
  ) {
    errors.push("to: must be a valid email or array of emails");
  }

  if (m.cc !== undefined && m.cc !== null) {
    const ccList = toArray(m.cc);
    if (!ccList.every(isValidRecipient)) {
      errors.push("cc: must be a valid email or array of emails");
    }
  }

  if (m.bcc !== undefined && m.bcc !== null) {
    const bccList = toArray(m.bcc);
    if (!bccList.every(isValidRecipient)) {
      errors.push("bcc: must be a valid email or array of emails");
    }
  }

  if (m.replyTo !== undefined && m.replyTo !== null && !isValidAddress(m.replyTo)) {
    errors.push("replyTo: must be a valid email address");
  }

  if (typeof m.subject !== "string" || m.subject.trim() === "") {
    errors.push("subject: is required");
  }

  if (m.text !== undefined && typeof m.text !== "string") {
    errors.push("text: must be a string");
  }

  if (m.html !== undefined && typeof m.html !== "string") {
    errors.push("html: must be a string");
  }

  if (m.headers !== undefined) {
    if (typeof m.headers !== "object" || m.headers === null || Array.isArray(m.headers)) {
      errors.push("headers: must be a record of strings");
    }
  }

  if (m.attachments !== undefined) {
    if (!Array.isArray(m.attachments)) {
      errors.push("attachments: must be an array");
    } else {
      m.attachments.forEach((att: unknown, i: number) => {
        if (!att || typeof att !== "object") {
          errors.push(`attachments[${i}]: must be an object`);
          return;
        }
        const a = att as Record<string, unknown>;
        if (typeof a.filename !== "string" || a.filename.trim() === "") {
          errors.push(`attachments[${i}].filename: is required`);
        }
      });
    }
  }

  if (errors.length > 0) {
    throw new Error(`Email validation failed:\n${errors.join("\n")}`);
  }

  if (!m.text && !m.html) {
    throw new Error("Email must have either 'text' or 'html' body");
  }

  return msg as EmailMessage;
}
