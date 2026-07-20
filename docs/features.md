# Features

## DKIM Signing

Sign emails with DKIM using `crypto.subtle` (zero dependencies).

### Via SMTP Transport

```typescript
import { SmtpTransport } from "unimailer/smtp";

const transport = new SmtpTransport({
  host: "smtp.example.com",
  port: 587,
  dkim: {
    domain: "example.com",
    selector: "default",
    privateKey: "-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----",
    headers: ["from", "to", "subject", "date", "message-id"],
  },
});
```

### Direct MIME Signing

```typescript
import { signMessage, createDkimSigner } from "unimailer";

// Sign a raw MIME message
const signed = await signMessage(rawMimeMessage, {
  domain: "example.com",
  selector: "default",
  privateKey: pemKey,
});

// Create a reusable signer
const signer = createDkimSigner({
  domain: "example.com",
  selector: "default",
  privateKey: pemKey,
});

const signed = await signer(rawMimeMessage);
```

---

## CSS Auto-Inlining

Inline `<style>` blocks into element `style` attributes. Essential for email clients.

```typescript
import { Mailer } from "unimailer";

const mailer = new Mailer(transport, { inlineCss: true });

await mailer.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Styled",
  html: `
    <style>
      .btn { color: white; background: #2563eb; padding: 8px 16px; }
      .header { font-size: 24px; font-weight: bold; }
    </style>
    <h1 class="header">Hello</h1>
    <button class="btn">Click me</button>
  `,
});
```

### Supported Selectors

| Selector | Example | Description |
|----------|---------|-------------|
| Tag | `p` | Matches all `<p>` elements |
| Class | `.btn` | Matches elements with `class="btn"` |
| ID | `#title` | Matches element with `id="title"` |
| Tag.class | `p.text` | Matches `<p>` with `class="text"` |
| Tag#id | `p#title` | Matches `<p>` with `id="title"` |

---

## Dry-Run Mode

Generate the raw MIME without actually sending.

```typescript
import { Mailer } from "unimailer";

const mailer = new Mailer(transport, { dryRun: true });

const result = await mailer.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Test",
  html: "<p>Hello</p>",
});

console.log(result.rawMime);     // Full RFC-compliant MIME message
console.log(result.messageId);   // "dry-run-1725772800000"
```

---

## Template Engine

Compile `{{variable}}` templates in subject, HTML, and text.

### Basic Usage

```typescript
import { compile, compileMessage } from "unimailer";

// Compile a single string
const text = compile("Hello {{name}}!", { name: "World" });
// "Hello World!"

// Compile an entire message
const message = compileMessage(
  {
    from: "a@b.com",
    to: "c@d.com",
    subject: "Welcome, {{name}}!",
    html: "<h1>Hello {{name}}</h1><p>Your account is {{status}}.</p>",
    text: "Hello {{name}}. Your account is {{status}}.",
  },
  { name: "Alice", status: "active" }
);
```

### Options

```typescript
compile(template, data, {
  openDelimiter: "{{",    // default
  closeDelimiter: "}}",   // default
  defaultValue: "",       // used for undefined/null values
});
```

### Nested Data

```typescript
compile("{{user.name}}", { user: { name: "Alice" } });
// "Alice"
```

---

## Dev Sandbox

Intercept emails in development. Preview HTML output.

```typescript
import { DevSandbox } from "unimailer";

const sandbox = new DevSandbox({ maxIntercepted: 50 });

await sandbox.send({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Test Email",
  html: "<p>Hello World</p>",
});

console.log(sandbox.count());           // 1
console.log(sandbox.getLast());         // InterceptedEmail object
console.log(sandbox.toHtmlPreview(id)); // Full HTML preview page
console.log(sandbox.toListHtml());      // HTML table of all intercepted emails
sandbox.clear();
```

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxIntercepted` | `number` | `100` | Max emails to keep in memory |

### Methods

| Method | Returns | Description |
|--------|---------|-------------|
| `send(message)` | `Promise<SendResult>` | Intercept an email |
| `getIntercepted()` | `InterceptedEmail[]` | All intercepted emails |
| `getLast()` | `InterceptedEmail \| undefined` | Most recent email |
| `getById(id)` | `InterceptedEmail \| undefined` | Find by message ID |
| `count()` | `number` | Number of intercepted emails |
| `clear()` | `void` | Remove all intercepted emails |
| `toHtmlPreview(id)` | `string \| null` | HTML preview page for one email |
| `toListHtml()` | `string` | HTML table of all emails |

---

## Webhook Verification

Verify and parse webhook events from supported providers.

```typescript
import { verifyWebhook, parseWebhookEvent } from "unimailer";

// Verify webhook signature
const result = await verifyWebhook(
  "resend",
  "your_webhook_secret",
  requestHeaders,
  requestBody,
);

if (result.valid) {
  const event = parseWebhookEvent("resend", requestBody);
  console.log(event.type);       // "email.delivered"
  console.log(event.messageId);  // "re_abc123"
  console.log(event.timestamp);  // Date object
}
```

### Supported Providers

| Provider | Signature Header |
|----------|-----------------|
| Resend | `svix-signature` |
| SendGrid | `x-twilio-signature` |
| Postmark | `x-pm-signature` |
| Mailgun | `x-mailgun-signature` |

---

## Runtime Detection

```typescript
import { detectRuntime, supportsNodeModules, supportsFetch, supportsCrypto } from "unimailer";

console.log(detectRuntime());       // "node" | "bun" | "deno" | "workerd" | "edge" | "unknown"
console.log(supportsNodeModules()); // true (node/bun only)
console.log(supportsFetch());       // true (all runtimes)
console.log(supportsCrypto());      // true (all runtimes)
```

---

## Validation

Messages are validated before sending. You can also validate manually.

```typescript
import { validateMessage } from "unimailer";

try {
  validateMessage({
    from: "sender@example.com",
    to: "recipient@example.com",
    subject: "Test",
    html: "<p>Hello</p>",
  });
} catch (err) {
  console.error(err.message);
  // "Email validation failed:\nfrom: must be a valid email address"
}
```

### Validation Rules

- `from`: Required, valid email or `{ name, address }`
- `to`: Required, valid email or array of emails
- `subject`: Required, non-empty string
- `html` or `text`: At least one required
- `cc`, `bcc`: Optional, valid email or array
- `replyTo`: Optional, valid email
- `headers`: Optional, `Record<string, string>`
- `attachments`: Optional, array with required `filename`

---

## MIME Encoding

Generate RFC-compliant MIME messages.

```typescript
import { encodeMessage, buildRawMime } from "unimailer";

const mime = await encodeMessage({
  from: "a@b.com",
  to: "c@d.com",
  subject: "Test",
  html: "<p>Hello</p>",
  text: "Hello",
  attachments: [{ filename: "test.txt", content: Buffer.from("data") }],
});

console.log(mime);
// MIME-Version: 1.0
// Date: Mon, 01 Sep 2025 00:00:00 GMT
// From: a@b.com
// To: c@d.com
// Subject: Test
// Content-Type: multipart/mixed; boundary="..."
// ...
```

### MIME Structure

| Content | Structure |
|---------|-----------|
| Text only | `text/plain` |
| HTML only | `text/html` |
| Text + HTML | `multipart/alternative` |
| With attachments | `multipart/mixed` containing body + attachment parts |
