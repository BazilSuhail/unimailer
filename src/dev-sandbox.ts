import type { Transport, EmailMessage, SendResult } from "./types.js";

export interface InterceptedEmail {
  id: string;
  message: EmailMessage;
  result: SendResult;
  rawMime?: string;
  timestamp: Date;
}

export interface DevSandboxOptions {
  maxIntercepted?: number;
  autoInlineCss?: boolean;
}

export class DevSandbox implements Transport {
  readonly id = "dev-sandbox";
  private intercepted: InterceptedEmail[] = [];
  private maxIntercepted: number;
  private counter = 0;

  constructor(options?: DevSandboxOptions) {
    this.maxIntercepted = options?.maxIntercepted ?? 100;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    this.counter++;
    const id = `dev-${this.counter}-${Date.now()}`;
    const result: SendResult = {
      messageId: id,
      transportId: this.id,
      timestamp: new Date(),
    };

    const entry: InterceptedEmail = {
      id,
      message: { ...message },
      result,
      timestamp: new Date(),
    };

    this.intercepted.push(entry);

    if (this.intercepted.length > this.maxIntercepted) {
      this.intercepted.shift();
    }

    return result;
  }

  getIntercepted(): InterceptedEmail[] {
    return [...this.intercepted];
  }

  getLast(): InterceptedEmail | undefined {
    return this.intercepted[this.intercepted.length - 1];
  }

  getById(id: string): InterceptedEmail | undefined {
    return this.intercepted.find((e) => e.id === id);
  }

  clear(): void {
    this.intercepted = [];
  }

  count(): number {
    return this.intercepted.length;
  }

  toHtmlPreview(interceptedId: string): string | null {
    const entry = this.getById(interceptedId);
    if (!entry) return null;

    const msg = entry.message;
    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Email Preview: ${escapeHtml(msg.subject)}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .meta { background: #fff; border-radius: 8px; padding: 16px; margin-bottom: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .meta dt { font-weight: 600; color: #555; }
    .meta dd { margin: 0 0 8px 0; color: #333; }
    .preview { background: #fff; border-radius: 8px; padding: 0; box-shadow: 0 1px 3px rgba(0,0,0,0.1); overflow: hidden; }
    .preview iframe { width: 100%; height: 500px; border: none; }
  </style>
</head>
<body>
  <div class="meta">
    <dl>
      <dt>Subject</dt>
      <dd>${escapeHtml(msg.subject)}</dd>
      <dt>From</dt>
      <dd>${escapeHtml(formatAddr(msg.from))}</dd>
      <dt>To</dt>
      <dd>${escapeHtml(Array.isArray(msg.to) ? msg.to.map(formatAddr).join(", ") : formatAddr(msg.to))}</dd>
      <dt>Message ID</dt>
      <dd>${escapeHtml(entry.result.messageId)}</dd>
    </dl>
  </div>
  <div class="preview">
    ${msg.html ? `<iframe srcdoc="${escapeAttr(msg.html)}"></iframe>` : `<pre>${escapeHtml(msg.text ?? "")}</pre>`}
  </div>
</body>
</html>`;
  }

  toListHtml(): string {
    const entries = this.getIntercepted();
    const rows = entries
      .map(
        (e) => `<tr>
      <td>${escapeHtml(e.id)}</td>
      <td>${escapeHtml(e.message.subject)}</td>
      <td>${escapeHtml(formatAddr(e.message.from))}</td>
      <td>${escapeHtml(Array.isArray(e.message.to) ? e.message.to.map(formatAddr).join(", ") : formatAddr(e.message.to))}</td>
      <td>${e.timestamp.toISOString()}</td>
      <td><a href="/preview/${escapeHtml(e.id)}">View</a></td>
    </tr>`,
      )
      .join("\n");

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Unimailer Dev Sandbox</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    table { background: #fff; border-radius: 8px; border-collapse: collapse; width: 100%; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #fafafa; font-weight: 600; }
    a { color: #2563eb; text-decoration: none; }
    .empty { color: #888; padding: 20px; text-align: center; }
  </style>
</head>
<body>
  <h1>Unimailer Dev Sandbox</h1>
  <p>${entries.length} email(s) intercepted</p>
  ${entries.length === 0 ? '<div class="empty">No emails sent yet. Use the DevSandbox transport to intercept outgoing emails.</div>' : `<table>
    <thead><tr><th>ID</th><th>Subject</th><th>From</th><th>To</th><th>Time</th><th>Action</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`}
</body>
</html>`;
  }
}

function formatAddr(
  addr: string | { name: string; address: string },
): string {
  if (typeof addr === "string") return addr;
  return `${addr.name} <${addr.address}>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function escapeAttr(str: string): string {
  return escapeHtml(str).replace(/"/g, "&quot;");
}
