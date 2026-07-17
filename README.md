# unimailer

Modern, type-safe email library for Node.js, Bun, and Deno.

A drop-in replacement for Nodemailer with automatic failover, retry logic, and full TypeScript support.

## Features

- **SMTP Transport** - Direct SMTP with TLS, AUTH PLAIN/LOGIN/OAuth2
- **Resend Transport** - HTTP-based via Resend API
- **Automatic Failover** - Try multiple transports with cascading fallback
- **Retry with Backoff** - Exponential backoff with jitter on transient errors
- **MIME Encoding** - RFC-compliant multipart/alternative and multipart/mixed
- **Type-Safe** - Full TypeScript with built-in validation
- **Attachments** - Binary, inline images with Content-ID
- **Tree-Shakable** - Import only what you need via subpath exports

## Install

```bash
npm install unimailer
```

## Quick Start

```typescript
import { Mailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const mailer = new Mailer(
  new ResendTransport({ apiKey: "re_your_api_key" })
);

await mailer.send({
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Welcome to our platform</h1>",
  text: "Welcome to our platform",
});
```

## SMTP

```typescript
import { Mailer } from "unimailer";
import { SmtpTransport } from "unimailer/smtp";

const mailer = new Mailer(
  new SmtpTransport({
    host: "smtp.gmail.com",
    port: 587,
    auth: {
      type: "plain",
      user: "you@gmail.com",
      pass: "app-password",
    },
  })
);

await mailer.send({
  from: "you@gmail.com",
  to: "recipient@example.com",
  subject: "Hello from SMTP",
  html: "<p>Sent via raw SMTP</p>",
});
```

## Failover

```typescript
import { FailoverMailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";
import { SmtpTransport } from "unimailer/smtp";

const mailer = new FailoverMailer([
  new ResendTransport({ apiKey: "re_..." }),
  new SmtpTransport({
    host: "smtp.backup.com",
    port: 587,
    auth: { type: "plain", user: "user", pass: "pass" },
  }),
]);

// Tries Resend first, falls back to SMTP if it fails
await mailer.send({
  from: "noreply@example.com",
  to: "user@example.com",
  subject: "Failover test",
  html: "<p>This will always arrive</p>",
});
```

## Retry

```typescript
import { Mailer, withRetry } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const transport = withRetry(
  new ResendTransport({ apiKey: "re_..." }),
  {
    maxRetries: 3,
    initialDelay: 1000,
    backoffMultiplier: 2,
  }
);

const mailer = new Mailer(transport);
```

## Attachments

```typescript
await mailer.send({
  from: "reports@example.com",
  to: "team@example.com",
  subject: "Monthly Report",
  html: "<p>Please see attached report.</p>",
  attachments: [
    {
      filename: "report.pdf",
      content: pdfBuffer,
      contentType: "application/pdf",
    },
    {
      filename: "logo.png",
      content: logoBuffer,
      cid: "company-logo", // Reference in HTML: <img src="cid:company-logo">
    },
  ],
});
```

## Custom Headers

```typescript
await mailer.send({
  from: "noreply@example.com",
  to: "user@example.com",
  subject: "With custom headers",
  html: "<p>Hello</p>",
  headers: {
    "List-Unsubscribe": "<mailto:unsubscribe@example.com>",
    "X-Campaign": "summer-2026",
  },
});
```

## API Reference

### `Mailer`

```typescript
new Mailer(transport: Transport)
mailer.send(message: EmailMessage): Promise<SendResult>
```

### `FailoverMailer`

```typescript
new FailoverMailer(transports: Transport[])
// Sends via first transport, cascades to next on failure
```

### `withRetry(transport, options?)`

Wraps any transport with retry logic.

### `SmtpTransport`

```typescript
new SmtpTransport({
  host: string,
  port?: number,          // default: 587
  secure?: boolean,       // default: false
  auth?: {
    type: "plain" | "login" | "oauth2",
    user: string,
    pass: string,
    // OAuth2 fields...
  },
  connectionTimeout?: number,
  socketTimeout?: number,
  tls?: { rejectUnauthorized?: boolean }
})
```

### `ResendTransport`

```typescript
new ResendTransport({
  apiKey: string,
  baseUrl?: string,
  timeout?: number,
})
```

### `EmailMessage`

```typescript
{
  from: string | { name: string; address: string };
  to: EmailRecipient | EmailRecipient[];
  cc?: EmailRecipient | EmailRecipient[];
  bcc?: EmailRecipient | EmailRecipient[];
  replyTo?: string | { name: string; address: string };
  subject: string;
  text?: string;
  html?: string;
  headers?: Record<string, string>;
  attachments?: Attachment[];
}
```

## License

MIT
