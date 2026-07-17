export function generateBoundary(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < 36; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return `----=_UniMailer_${result}`;
}

export const CRLF = "\r\n";

export function foldAddress(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
}

export function foldRecipients(
  recipients: string | { name: string; address: string } | (string | { name: string; address: string })[],
): string[] {
  const list = Array.isArray(recipients) ? recipients : [recipients];
  return list.map(foldAddress);
}

export function encodeBase64Lines(data: Buffer | Uint8Array): string {
  const base64 =
    typeof globalThis.btoa === "function"
      ? globalThis.btoa(String.fromCharCode(...new Uint8Array(data)))
      : Buffer.from(data).toString("base64");

  const lines: string[] = [];
  for (let i = 0; i < base64.length; i += 76) {
    lines.push(base64.slice(i, i + 76));
  }
  return lines.join(CRLF);
}

export function guessMimeType(filename: string): string {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const map: Record<string, string> = {
    pdf: "application/pdf",
    doc: "application/msword",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xls: "application/vnd.ms-excel",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    svg: "image/svg+xml",
    webp: "image/webp",
    txt: "text/plain",
    html: "text/html",
    css: "text/css",
    json: "application/json",
    zip: "application/zip",
    gz: "application/gzip",
    tar: "application/x-tar",
    mp3: "audio/mpeg",
    mp4: "video/mp4",
    ics: "text/calendar",
  };
  return map[ext] ?? "application/octet-stream";
}
