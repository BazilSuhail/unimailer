# Providers

unimailer supports 6 email providers via tree-shakable subpath imports.

## SMTP

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

### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `host` | `string` | — | SMTP server hostname |
| `port` | `number` | `587` | SMTP port |
| `secure` | `boolean` | `false` | Use TLS from start (port 465) |
| `auth` | `SmtpAuth` | — | Authentication config |
| `connectionTimeout` | `number` | `10000` | Connection timeout (ms) |
| `socketTimeout` | `number` | `30000` | Socket timeout (ms) |
| `tls` | `object` | — | TLS options |
| `pool` | `object` | — | Connection pool config |
| `dkim` | `DkimOptions` | — | DKIM signing config |

### Auth Types

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

### Connection Pool

```typescript
const transport = new SmtpTransport({
  host: "smtp.example.com",
  port: 587,
  auth: { type: "plain", user: "u", pass: "p" },
  pool: {
    enabled: true,
    maxConnections: 5,
    idleTimeout: 60000,
  },
});
```

---

## Resend

HTTP-based via the [Resend API](https://resend.com).

```typescript
import { ResendTransport } from "unimailer/resend";

const transport = new ResendTransport({
  apiKey: "re_your_api_key",
  baseUrl: "https://api.resend.com",
  timeout: 30000,
});
```

---

## SendGrid

HTTP-based via the [SendGrid API](https://sendgrid.com).

```typescript
import { SendGridTransport } from "unimailer/sendgrid";

const transport = new SendGridTransport({
  apiKey: "SG.your_api_key",
  baseUrl: "https://api.sendgrid.com",
  timeout: 30000,
  sandboxMode: false,
});
```

---

## Postmark

HTTP-based via the [Postmark API](https://postmarkapp.com).

```typescript
import { PostmarkTransport } from "unimailer/postmark";

const transport = new PostmarkTransport({
  serverToken: "your_server_token",
  baseUrl: "https://api.postmarkapp.com",
  timeout: 30000,
  messageStream: "outbound",
});
```

---

## AWS SES

HTTP-based via [AWS SES v2 API](https://docs.aws.amazon.com/ses/latest/APIReference-V2/) with zero-dependency SigV4 signing.

```typescript
import { SesTransport } from "unimailer/ses";

const transport = new SesTransport({
  accessKeyId: "AKIAIOSFODNN7EXAMPLE",
  secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
  region: "us-east-1",
  sessionToken: "optional-temp-token",
  configurationSet: "my-config-set",
  tags: { campaign: "summer-2026" },
});
```

---

## Mailgun

HTTP-based via the [Mailgun API](https://www.mailgun.com).

```typescript
import { MailgunTransport } from "unimailer/mailgun";

const transport = new MailgunTransport({
  apiKey: "your_api_key",
  domain: "mg.example.com",
  region: "us",  // or "eu"
  timeout: 30000,
});
```
