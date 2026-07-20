# Getting Started

## Installation

```bash
npm install unimailer
```

## Requirements

- Node.js >= 18
- Bun, Deno, or any runtime with `fetch` and `crypto.subtle`

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

console.log(result.messageId);
```

## What's Next

- [Providers](./providers.md) - Configure your email transport
- [Message Format](./message-format.md) - Structure your emails
- [Middleware](./middleware.md) - Add retry, rate limiting, queues, and more
- [Features](./features.md) - DKIM, templates, CSS inlining, and more
