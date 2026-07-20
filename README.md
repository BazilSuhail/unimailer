<div align="center">

# unimailer

**Modern, zero-dependency, type-safe email library for Node.js, Bun, Deno, and Edge.**

A drop-in replacement for Nodemailer with automatic failover, retry logic, DKIM signing, and full TypeScript support.

[![npm version](https://img.shields.io/npm/v/unimailer?style=flat-square&color=blue)](https://www.npmjs.com/package/unimailer)
[![license](https://img.shields.io/npm/l/unimailer?style=flat-square)](https://github.com/BazilSuhail/unimailer/blob/main/LICENSE)
[![build](https://img.shields.io/github/actions/workflow/status/BazilSuhail/unimailer/ci.yml?style=flat-square&label=build)](https://github.com/BazilSuhail/unimailer/actions)
[![downloads](https://img.shields.io/npm/dm/unimailer?style=flat-square)](https://www.npmjs.com/package/unimailer)
[![bundle size](https://img.shields.io/bundlephobia/minzip/unimailer?style=flat-square)](https://bundlephobia.com/package/unimailer)
[![node](https://img.shields.io/node/v-unimailer?style=flat-square)](https://nodejs.org)
[![typescript](https://img.shields.io/badge/TypeScript-5.7-blue?style=flat-square&logo=typescript)](https://www.typescriptlang.org)

</div>

---

## Overview

unimailer is a **zero-dependency**, multi-runtime email library that gives you everything Nodemailer does — and more — without any of the bloat.

### Why unimailer?

| Feature | unimailer | Nodemailer |
|---------|-----------|------------|
| Zero runtime dependencies | ✅ | ❌ (3+) |
| Full TypeScript | ✅ | ❌ |
| Built-in retry + backoff | ✅ | ❌ |
| Automatic failover | ✅ | ❌ |
| DKIM signing (crypto.subtle) | ✅ | ❌ |
| Rate limiting | ✅ | ❌ |
| Concurrency queue | ✅ | ❌ |
| Circuit breaker | ✅ | ❌ |
| Metrics collection | ✅ | ❌ |
| Dry-run mode | ✅ | ❌ |
| CSS auto-inlining | ✅ | ❌ |
| Template engine | ✅ | ❌ |
| Webhook verification | ✅ | ❌ |
| Multi-runtime (Node/Bun/Deno/Edge) | ✅ | ❌ |
| Tree-shakable subpath exports | ✅ | ❌ |
| Dev sandbox for preview | ✅ | ❌ |

### Supported Providers

| Provider | Transport | Auth |
|----------|-----------|------|
| SMTP (Gmail, Outlook, etc.) | `unimailer/smtp` | PLAIN / LOGIN / OAuth2 |
| Resend | `unimailer/resend` | API Key |
| SendGrid | `unimailer/sendgrid` | API Key |
| Postmark | `unimailer/postmark` | Server Token |
| AWS SES | `unimailer/ses` | IAM Credentials (SigV4) |
| Mailgun | `unimailer/mailgun` | API Key |

---

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Providers](#providers)
  - [SMTP](#smtp)
  - [Resend](#resend)
  - [SendGrid](#sendgrid)
  - [Postmark](#postmark)
  - [AWS SES](#aws-ses)
  - [Mailgun](#mailgun)
- [Message Format](#message-format)
  - [Basic Fields](#basic-fields)
  - [Recipients](#recipients)
  - [Attachments](#attachments)
  - [Inline Images](#inline-images)
  - [ReadableStream Attachments](#readablestream-attachments)
  - [Custom Headers](#custom-headers)
- [Core APIs](#core-apis)
  - [Mailer](#mailer)
  - [createMailer](#createmailer)
  - [FailoverMailer](#failovermailer)
- [Middleware](#middleware)
  - [Retry](#retry)
  - [Rate Limiter](#rate-limiter)
  - [Queue](#queue)
  - [Circuit Breaker](#circuit-breaker)
  - [Metrics](#metrics)
- [Features](#features)
  - [DKIM Signing](#dkim-signing)
  - [CSS Auto-Inlining](#css-auto-inlining)
  - [Dry-Run Mode](#dry-run-mode)
  - [Template Engine](#template-engine)
  - [Dev Sandbox](#dev-sandbox)
  - [Webhook Verification](#webhook-verification)
  - [Runtime Detection](#runtime-detection)
  - [Validation](#validation)
  - [MIME Encoding](#mime-encoding)
- [Hooks](#hooks)
- [Subpath Exports](#subpath-exports)
- [API Reference](#api-reference)
- [License](#license)

---

## Installation

```bash
npm install unimailer
```

```bash
yarn add unimailer
```

```bash
pnpm add unimailer
```

```bash
bun add unimailer
```

**Requirements:** Node.js >= 18, Bun, Deno, or any runtime with `fetch` and `crypto.subtle`.

---

## Quick Start

```typescript
import { createMailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const mailer = createMailer({
  providers: [new ResendTransport({ apiKey: "re_your_key" })],
});

const result = await mailer.send({
  from: "hello@example.com",
  to: "user@example.com",
  subject: "Welcome!",
  html: "<h1>Welcome to our platform</h1>",
  text: "Welcome to our platform",
});

console.log(result.messageId); // "re_abc123"
```

---

## Providers

### SMTP

Raw SMTP with TLS, connection pooling, and DKIM support.

```typescript
import { SmtpTransport } from "unimailer/smtp";

const transport = new SmtpTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    type: "plain",
    user: "you@gmail.com",
    pass: "app-password",
  },
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | — | SMTP server hostname |
| `port` | `number` | `587` | SMTP port |
| `secure` | `boolean` | `false` | Use TLS from start (port 465) |
| `auth` | `SmtpAuth` | — | Authentication config |
| `connectionTimeout` | `number` | `10000` | Connection timeout (ms) |
| `socketTimeout` | `number` | `30000` | Socket timeout (ms) |
| `greetingTimeout` | `number` | — | Greeting timeout (ms) |
| `tls` | `object` | — | TLS options |
| `tls.rejectUnauthorized` | `boolean` | — | Verify TLS certificate |
| `tls.minVersion` | `string` | — | Minimum TLS version |
| `pool` | `object` | — | Connection pool config |
| `pool.enabled` | `boolean` | — | Enable pooling |
| `pool.maxConnections` | `number` | — | Max simultaneous connections |
| `pool.idleTimeout` | `number` | — | Idle connection timeout (ms) |
| `dkim` | `DkimOptions` | — | DKIM signing config |

**Auth types:**

```typescript
// PLAIN
{ type: "plain", user: "user", pass: "pass" }

// LOGIN
{ type: "login", user: "user", pass: "pass" }

// OAuth2
{
  type: "oauth2",
  user: "user",
  clientId: "client-id",
  clientSecret: "client-secret",
  refreshToken: "refresh-token",
  accessToken: "optional-access-token",
}
```

### Resend

HTTP-based via the [Resend API](https://resend.com).

```typescript
import { ResendTransport } from "unimailer/resend";

const transport = new ResendTransport({
  apiKey: "re_your_api_key",
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Resend API key |
| `baseUrl` | `string` | `https://api.resend.com` | API base URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |

### SendGrid

HTTP-based via the [SendGrid API](https://sendgrid.com).

```typescript
import { SendGridTransport } from "unimailer/sendgrid";

const transport = new SendGridTransport({
  apiKey: "SG.your_api_key",
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | SendGrid API key |
| `baseUrl` | `string` | `https://api.sendgrid.com` | API base URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `sandboxMode` | `boolean` | `false` | Enable SendGrid sandbox |

### Postmark

HTTP-based via the [Postmark API](https://postmarkapp.com).

```typescript
import { PostmarkTransport } from "unimailer/postmark";

const transport = new PostmarkTransport({
  serverToken: "your_server_token",
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `serverToken` | `string` | — | Postmark server token |
| `baseUrl` | `string` | `https://api.postmarkapp.com` | API base URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `messageStream` | `string` | `"outbound"` | Message stream ID |

### AWS SES

HTTP-based via [AWS SES v2 API](https://docs.aws.amazon.com/ses/latest/APIReference-V2/) with **zero-dependency SigV4 signing**.

```typescript
import { SesTransport } from "unimailer/ses";

const transport = new SesTransport({
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `accessKeyId` | `string` | — | AWS access key ID |
| `secretAccessKey` | `string` | — | AWS secret access key |
| `region` | `string` | `"us-east-1"` | AWS region |
| `sessionToken` | `string` | — | Temporary session token |
| `baseUrl` | `string` | — | Custom SES endpoint URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `configurationSet` | `string` | — | SES configuration set name |
| `tags` | `Record<string, string>` | — | SES email tags |

### Mailgun

HTTP-based via the [Mailgun API](https://www.mailgun.com).

```typescript
import { MailgunTransport } from "unimailer/mailgun";

const transport = new MailgunTransport({
  apiKey: "your_api_key",
  domain: "mg.example.com",
});
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `apiKey` | `string` | — | Mailgun API key |
| `domain` | `string` | — | Mailgun domain |
| `baseUrl` | `string` | — | Custom API base URL |
| `timeout` | `number` | `30000` | Request timeout (ms) |
| `region` | `"us" \| "eu"` | `"us"` | API region |

---

## Message Format

### Basic Fields

```typescript
await mailer.send({
  from: "sender@example.com",             // required
  to: "recipient@example.com",           // required
  subject: "Hello World",                // required
  html: "<p>Rich HTML content</p>",      // at least html or text required
  text: "Plain text fallback",           // at least html or text required
});
```

### Recipients

```typescript
// Single string
to: "user@example.com"

// Array of strings
to: ["user1@example.com", "user2@example.com"]

// Named objects
to: [
  { name: "Alice", address: "alice@example.com" },
  { name: "Bob", address: "bob@example.com" },
]

// Mixed
to: ["plain@example.com", { name: "Named", address: "named@example.com" }]
```

**CC and BCC:**

```typescript
await mailer.send({
  from: "sender@example.com",
  to: "user@example.com",
  cc: "manager@example.com",
  bcc: ["audit1@example.com", "audit2@example.com"],
  subject: "Report",
  html: "<p>Monthly report</p>",
});
```

**Reply-To:**

```typescript
await mailer.send({
  from: "noreply@example.com",
  to: "user@example.com",
  replyTo: "support@example.com",
  subject: "Notification",
  html: "<p>You have a new notification</p>",
});
```

### Attachments

```typescript
import { readFileSync } from "node:fs";

await mailer.send({
  from: "reports@example.com",
  to: "team@example.com",
  subject: "Monthly Report",
  html: "<p>Please see attached report.</p>",
  attachments: [
    {
      filename: "report.pdf",
      content: readFileSync("./report.pdf"),
      contentType: "application/pdf",
    },
    {
      filename: "data.csv",
      content: "name,age\nAlice,30\nBob,25",
      contentType: "text/csv",
    },
  ],
});
```

**Attachment fields:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | `string` | yes | File name |
| `content` | `string \| Buffer \| Uint8Array \| ReadableStream` | no | File content |
| `path` | `string` | no | File path (not yet implemented) |
| `contentType` | `string` | no | MIME type (auto-guessed if omitted) |
| `cid` | `string` | no | Content-ID for inline images |

### Inline Images

```typescript
await mailer.send({
  from: "design@example.com",
  to: "user@example.com",
  subject: "New Design",
  html: `
    <h1>Check out our new logo</h1>
    <img src="cid:company-logo" alt="Logo" />
  `,
  attachments: [
    {
      filename: "logo.png",
      content: logoBuffer,
      cid: "company-logo",
    },
  ],
});
```

### ReadableStream Attachments

```typescript
const response = await fetch("https://example.com/file.pdf");
const stream = response.body!;

await mailer.send({
  from: "files@example.com",
  to: "user@example.com",
  subject: "Remote File",
  html: "<p>Attached file from URL</p>",
  attachments: [
    {
      filename: "file.pdf",
      content: stream,
      contentType: "application/pdf",
    },
  ],
});
```

### Custom Headers

```typescript
await mailer.send({
  from: "noreply@example.com",
  to: "user@example.com",
  subject: "Campaign Email",
  html: "<p>Hello</p>",
  headers: {
    "List-Unsubscribe": "<mailto:unsubscribe@example.com>",
    "X-Campaign": "summer-2026",
    "X-Mailer": "unimailer",
  },
});
```

---

## Core APIs

### Mailer

The basic mailer class. Wraps a single transport.

```typescript
import { Mailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const mailer = new Mailer(
  new ResendTransport({ apiKey: "re_key" }),
  {
    dryRun: false,
    inlineCss: true,
    onSend: (msg, result) => console.log("Sent:", result.messageId),
    onError: (msg, err) => console.error("Failed:", err.message),
  }
);

await mailer.send(message);
```

**MailerOptions:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `dryRun` | `boolean` | `false` | Generate MIME without sending |
| `inlineCss` | `boolean` | `false` | Auto-inline `<style>` blocks |
| `onSend` | `(msg, result) => void` | — | Called after successful send |
| `onError` | `(msg, error) => void` | — | Called on send failure |

### createMailer

The recommended way to create a mailer. Supports all middleware options.

```typescript
import { createMailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";
import { SmtpTransport } from "unimailer/smtp";

const mailer = createMailer({
  providers: [
    new ResendTransport({ apiKey: "re_key" }),
    new SmtpTransport({
      host: "smtp.backup.com",
      port: 587,
      auth: { type: "plain", user: "u", pass: "p" },
    }),
  ],
  retry: { maxRetries: 3, initialDelay: 1000 },
  failover: true,
  rateLimit: { maxPerSecond: 10 },
  queue: { concurrency: 5 },
  circuitBreaker: { failureThreshold: 5, halfOpenAfter: 30000 },
  metrics: true,
  dryRun: false,
  inlineCss: false,
  onSend: (msg, result) => console.log("Sent:", result.messageId),
  onError: (msg, err) => console.error("Failed:", err.message),
});

await mailer.send(message);

// Access middleware instances
mailer.metrics?.snapshot();
mailer.queue?.size;
mailer.circuitBreaker?.getState();
```

**MailerConfig:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `providers` | `Transport[]` | — | Transport(s) to use |
| `retry` | `RetryOptions \| false` | enabled | Retry config or `false` to disable |
| `failover` | `boolean` | `false` | Enable failover across providers |
| `rateLimit` | `RateLimiterOptions` | — | Rate limiting config |
| `queue` | `QueueOptions` | — | Queue config |
| `circuitBreaker` | `CircuitBreakerOptions` | — | Circuit breaker config |
| `metrics` | `boolean` | `false` | Enable metrics collection |
| `dryRun` | `boolean` | `false` | Generate MIME without sending |
| `inlineCss` | `boolean` | `false` | Auto-inline CSS |
| `onSend` | `(msg, result) => void` | — | Success hook |
| `onError` | `(msg, error) => void` | — | Error hook |

### FailoverMailer

Tries transports in order, cascading on failure.

```typescript
import { FailoverMailer } from "unimailer";
import { ResendTransport } from "unimailer/resend";
import { SmtpTransport } from "unimailer/smtp";

const mailer = new FailoverMailer([
  new ResendTransport({ apiKey: "re_..." }),
  new SmtpTransport({
    host: "smtp.backup.com",
    port: 587,
    auth: { type: "plain", user: "u", pass: "p" },
  }),
]);

// Tries Resend first, falls back to SMTP on failure
await mailer.send(message);
```

---

## Middleware

All middleware implement the `Transport` interface and can be composed together.

### Retry

Retries failed sends with exponential backoff and jitter.

```typescript
import { withRetry } from "unimailer";
import { ResendTransport } from "unimailer/resend";

const transport = withRetry(
  new ResendTransport({ apiKey: "re_..." }),
  {
    maxRetries: 3,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
    retryOn: (error) => error.retryable,
  }
);
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxRetries` | `number` | `3` | Maximum retry attempts |
| `initialDelay` | `number` | `1000` | Initial delay (ms) |
| `maxDelay` | `number` | `30000` | Maximum delay (ms) |
| `backoffMultiplier` | `number` | `2` | Exponential backoff multiplier |
| `retryOn` | `(error) => boolean` | — | Custom retry condition |

**Auto-retryable errors:** 429 (rate limit), 408 (timeout), 503 (unavailable), 504 (gateway timeout).

### Rate Limiter

Token bucket rate limiting per transport.

```typescript
import { withRateLimiter } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const transport = withRateLimiter(
  new ResendTransport({ apiKey: "re_..." }),
  {
    maxPerSecond: 10,
    maxPerMinute: 300,
  }
);
```

**Options:**

| Option | Type | Description |
|--------|------|-------------|
| `maxPerSecond` | `number` | Maximum sends per second |
| `maxPerMinute` | `number` | Maximum sends per minute (optional) |

### Queue

Concurrency-limited queue with backpressure.

```typescript
import { MailQueue } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const queue = new MailQueue(
  new ResendTransport({ apiKey: "re_..." }),
  {
    concurrency: 5,
    maxSize: 1000,
  }
);

await queue.send(message); // Returns immediately or waits for a slot
console.log(queue.size);   // Pending items
console.log(queue.active); // In-flight sends

await queue.close(); // Wait for all pending to complete
```

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `concurrency` | `number` | — | Max simultaneous sends |
| `maxSize` | `number` | `1000` | Max queue size (pending + in-flight) |

### Circuit Breaker

Auto-disables a transport after repeated failures, auto-recovers after timeout.

```typescript
import { CircuitBreaker } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const breaker = new CircuitBreaker(
  new ResendTransport({ apiKey: "re_..." }),
  {
    failureThreshold: 5,
    halfOpenAfter: 30000,
  }
);

console.log(breaker.getState()); // "closed" | "open" | "half-open"
breaker.reset(); // Manually close the circuit
```

**States:**

| State | Behavior |
|-------|----------|
| `closed` | Normal operation. Failures are counted. |
| `open` | All sends rejected immediately. |
| `half-open` | After `halfOpenAfter` ms, allows test sends. 2 successes = close. |

**Options:**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `failureThreshold` | `number` | — | Failures before opening circuit |
| `halfOpenAfter` | `number` | `5000` | Ms before trying half-open |

### Metrics

Tracks send counts, failures, latencies, and errors per transport.

```typescript
import { MetricsCollector } from "unimailer/middleware";
import { ResendTransport } from "unimailer/resend";

const metrics = new MetricsCollector(
  new ResendTransport({ apiKey: "re_..." })
);

await metrics.send(message);
await metrics.send(message);

const snapshot = metrics.snapshot();
console.log(snapshot.total);      // 2
console.log(snapshot.success);    // 2
console.log(snapshot.failure);    // 0
console.log(snapshot.latencies);  // [45, 38]
console.log(snapshot.byTransport); // { resend: { success: 2, failure: 0, avgLatency: 41.5 } }

metrics.reset(); // Clear all data
```

**Snapshot:**

```typescript
{
  total: number;
  success: number;
  failure: number;
  latencies: number[];
  errors: Array<{ transportId: string; code: string; timestamp: number }>;
  byTransport: Record<string, {
    success: number;
    failure: number;
    avgLatency: number;
  }>;
}
```

---

## Features

### DKIM Signing

Sign emails with DKIM using `crypto.subtle` (zero dependencies).

```typescript
import { signMessage, createDkimSigner } from "unimailer";
import { SmtpTransport } from "unimailer/smtp";

// Option 1: Via SMTP transport config
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

// Option 2: Sign raw MIME directly
const signer = createDkimSigner({
  domain: "example.com",
  selector: "default",
  privateKey: pemKey,
});

const signed = await signer(rawMimeMessage);
```

### CSS Auto-Inlining

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
// Output: <h1 class="header" style="font-size: 24px; font-weight: bold;">Hello</h1>
//         <button class="btn" style="color: white; background: #2563eb; padding: 8px 16px;">Click me</button>
```

**Supported selectors:** tag (`p`), class (`.btn`), id (`#title`), tag.class (`p.text`), tag#id (`p#title`).

### Dry-Run Mode

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

console.log(result.rawMime); // Full RFC-compliant MIME message
console.log(result.messageId); // "dry-run-1725772800000"
```

### Template Engine

Compile `{{variable}}` templates in subject, HTML, and text.

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
// subject: "Welcome, Alice!"
// html: "<h1>Hello Alice</h1><p>Your account is active.</p>"
```

**Options:**

```typescript
compile(template, data, {
  openDelimiter: "{{",    // default
  closeDelimiter: "}}",   // default
  defaultValue: "",       // used for undefined/null values
});
```

**Nested data:**

```typescript
compile("{{user.name}}", { user: { name: "Alice" } });
// "Alice"
```

### Dev Sandbox

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

console.log(sandbox.count());          // 1
console.log(sandbox.getLast());        // InterceptedEmail object
console.log(sandbox.toHtmlPreview(id)); // Full HTML preview page
console.log(sandbox.toListHtml());      // HTML table of all intercepted emails
sandbox.clear();
```

### Webhook Verification

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

**Supported providers:** `resend`, `sendgrid`, `postmark`, `mailgun`.

### Runtime Detection

```typescript
import { detectRuntime, supportsNodeModules, supportsFetch, supportsCrypto } from "unimailer";

console.log(detectRuntime());      // "node" | "bun" | "deno" | "workerd" | "edge" | "unknown"
console.log(supportsNodeModules()); // true (node/bun)
console.log(supportsFetch());       // true
console.log(supportsCrypto());      // true
```

### Validation

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

### MIME Encoding

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

---

## Hooks

```typescript
const mailer = createMailer({
  providers: [transport],
  onSend: (message, result) => {
    console.log(`Sent to ${message.to} via ${result.transportId}`);
    console.log(`Message ID: ${result.messageId}`);
  },
  onError: (message, error) => {
    console.error(`Failed to send to ${message.to}`);
    console.error(`Error: ${error.code} - ${error.message}`);
    console.error(`Transport: ${error.transportId}`);
    console.error(`Retryable: ${error.retryable}`);
  },
});
```

---

## Subpath Exports

Tree-shakable imports — only load what you need.

```typescript
import { Mailer, createMailer, FailoverMailer, withRetry } from "unimailer";
import { SmtpTransport, SmtpPool } from "unimailer/smtp";
import { ResendTransport } from "unimailer/resend";
import { SendGridTransport } from "unimailer/sendgrid";
import { PostmarkTransport } from "unimailer/postmark";
import { SesTransport } from "unimailer/ses";
import { MailgunTransport } from "unimailer/mailgun";
import { withRateLimiter, MailQueue, CircuitBreaker, MetricsCollector } from "unimailer/middleware";
```

---

## API Reference

### Types

```typescript
interface EmailMessage {
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

type EmailRecipient = string | { name: string; address: string };

interface Attachment {
  filename: string;
  content?: string | Buffer | Uint8Array | ReadableStream<Uint8Array>;
  path?: string;
  contentType?: string;
  cid?: string;
}

interface SendResult {
  messageId: string;
  transportId: string;
  timestamp: Date;
  rawMime?: string;
}

interface SendError extends Error {
  code: string;
  statusCode?: number;
  transportId: string;
  retryable: boolean;
}

interface Transport {
  id: string;
  send(message: EmailMessage): Promise<SendResult>;
}
```

### `createSendError`

```typescript
import { createSendError } from "unimailer";

const error = createSendError("Connection failed", "smtp", {
  code: "CONNECTION_FAILED",
  statusCode: 503,
  retryable: true,
  cause: originalError,
});
```

---

## License

MIT - [Bazil Suhail](https://github.com/BazilSuhail)
