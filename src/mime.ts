import type { EmailMessage, Attachment, EmailRecipient } from "./types.js";
import {
  CRLF,
  generateBoundary,
  foldAddress,
  encodeBase64Lines,
  guessMimeType,
} from "./utils.js";

function recipientList(
  label: string,
  recipients: EmailRecipient | EmailRecipient[],
): string {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return `${label}: ${list.map(foldAddress).join(", ")}${CRLF}`;
}

function buildTextPart(text: string, boundary: string): string {
  return [
    `${CRLF}--${boundary}`,
    `Content-Type: text/plain; charset="UTF-8"`,
    `Content-Transfer-Encoding: 7bit`,
    `${CRLF}${text}`,
  ].join(CRLF);
}

function buildHtmlPart(html: string, boundary: string): string {
  return [
    `${CRLF}--${boundary}`,
    `Content-Type: text/html; charset="UTF-8"`,
    `Content-Transfer-Encoding: quoted-printable`,
    `${CRLF}${html}`,
  ].join(CRLF);
}

function buildAttachmentPart(
  att: Attachment,
  boundary: string,
): string {
  const contentBuffer =
    att.content instanceof Uint8Array
      ? att.content
      : typeof att.content === "string"
        ? Buffer.from(att.content, "base64")
        : att.content ?? Buffer.alloc(0);

  const contentType = att.contentType ?? guessMimeType(att.filename);
  const contentId = att.cid
    ? `${CRLF}Content-ID: <${att.cid}>`
    : "";
  const disposition = att.cid
    ? `Content-Disposition: inline; filename="${att.filename}"`
    : `Content-Disposition: attachment; filename="${att.filename}"`;

  return [
    `${CRLF}--${boundary}`,
    `Content-Type: ${contentType}`,
    `Content-Transfer-Encoding: base64`,
    disposition,
    contentId,
    `${CRLF}${encodeBase64Lines(contentBuffer)}`,
  ]
    .filter((line) => line !== "")
    .join(CRLF);
}

function buildHeaders(message: EmailMessage): string {
  const lines: string[] = [];

  lines.push(`MIME-Version: 1.0`);
  lines.push(`Date: ${new Date().toUTCString()}`);
  lines.push(`From: ${foldAddress(message.from)}`);
  lines.push(recipientList("To", message.to));

  if (message.cc) lines.push(recipientList("Cc", message.cc));
  if (message.bcc) lines.push(recipientList("Bcc", message.bcc));
  if (message.replyTo) {
    lines.push(`Reply-To: ${foldAddress(message.replyTo)}`);
  }

  lines.push(`Subject: ${message.subject}`);

  if (message.headers) {
    for (const [key, value] of Object.entries(message.headers)) {
      lines.push(`${key}: ${value}`);
    }
  }

  return lines.join(CRLF);
}

export function encodeMessage(message: EmailMessage): string {
  const hasText = !!message.text;
  const hasHtml = !!message.html;
  const hasAttachments = !!message.attachments?.length;

  const headers = buildHeaders(message);
  const bodyBoundary = generateBoundary();

  if (!hasAttachments && (hasText || hasHtml)) {
    if (hasText && hasHtml) {
      const altBoundary = generateBoundary();
      const altBody = [
        `${CRLF}--${altBoundary}`,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        buildTextPart(message.text!, altBoundary),
        buildHtmlPart(message.html!, altBoundary),
        `${CRLF}--${altBoundary}--`,
      ].join(CRLF);

      return [
        headers,
        `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
        altBody,
        `${CRLF}--${altBoundary}--`,
      ].join(CRLF);
    }

    if (hasHtml) {
      return [
        headers,
        `Content-Type: text/html; charset="UTF-8"`,
        `Content-Transfer-Encoding: quoted-printable`,
        `${CRLF}${message.html}`,
      ].join(CRLF);
    }

    return [
      headers,
      `Content-Type: text/plain; charset="UTF-8"`,
      `Content-Transfer-Encoding: 7bit`,
      `${CRLF}${message.text}`,
    ].join(CRLF);
  }

  const parts: string[] = [];

  if (hasText || hasHtml) {
    if (hasText && hasHtml) {
      const altBoundary = generateBoundary();
      parts.push(
        [
          `${CRLF}--${bodyBoundary}`,
          `Content-Type: multipart/alternative; boundary="${altBoundary}"`,
          buildTextPart(message.text!, altBoundary),
          buildHtmlPart(message.html!, altBoundary),
          `${CRLF}--${altBoundary}--`,
        ].join(CRLF),
      );
    } else if (hasHtml) {
      parts.push(
        [
          `${CRLF}--${bodyBoundary}`,
          `Content-Type: text/html; charset="UTF-8"`,
          `Content-Transfer-Encoding: quoted-printable`,
          `${CRLF}${message.html}`,
        ].join(CRLF),
      );
    } else {
      parts.push(
        [
          `${CRLF}--${bodyBoundary}`,
          `Content-Type: text/plain; charset="UTF-8"`,
          `Content-Transfer-Encoding: 7bit`,
          `${CRLF}${message.text}`,
        ].join(CRLF),
      );
    }
  }

  if (hasAttachments) {
    for (const att of message.attachments!) {
      parts.push(buildAttachmentPart(att, bodyBoundary));
    }
  }

  return [
    headers,
    `Content-Type: multipart/mixed; boundary="${bodyBoundary}"`,
    parts.join(""),
    `${CRLF}--${bodyBoundary}--`,
  ].join(CRLF);
}

export function buildRawMime(message: EmailMessage): string {
  return encodeMessage(message);
}
