# Message Format

## Basic Fields

```typescript
await mailer.send({
  from: "sender@example.com",       // required
  to: "recipient@example.com",     // required
  subject: "Hello World",          // required
  html: "<p>Rich HTML</p>",        // at least html or text
  text: "Plain text",              // at least html or text
});
```

## Recipients

### Single string

```typescript
to: "user@example.com"
```

### Array of strings

```typescript
to: ["user1@example.com", "user2@example.com"]
```

### Named objects

```typescript
to: [
  { name: "Alice", address: "alice@example.com" },
  { name: "Bob", address: "bob@example.com" },
]
```

### Mixed

```typescript
to: ["plain@example.com", { name: "Named", address: "named@example.com" }]
```

## CC and BCC

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

## Reply-To

```typescript
await mailer.send({
  from: "noreply@example.com",
  to: "user@example.com",
  replyTo: "support@example.com",
  subject: "Notification",
  html: "<p>You have a new notification</p>",
});
```

## Attachments

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

### Attachment Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `filename` | `string` | yes | File name |
| `content` | `string \| Buffer \| Uint8Array \| ReadableStream` | no | File content |
| `contentType` | `string` | no | MIME type (auto-guessed) |
| `cid` | `string` | no | Content-ID for inline images |

## Inline Images

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

## ReadableStream Attachments

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

## Custom Headers

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
