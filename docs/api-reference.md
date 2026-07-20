# API Reference

## Types

### EmailMessage

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
```

### EmailRecipient

```typescript
type EmailRecipient = string | { name: string; address: string };
```

### Attachment

```typescript
interface Attachment {
  filename: string;
  content?: string | Buffer | Uint8Array | ReadableStream<Uint8Array>;
  path?: string;
  contentType?: string;
  cid?: string;
}
```

### SendResult

```typescript
interface SendResult {
  messageId: string;
  transportId: string;
  timestamp: Date;
  rawMime?: string;
}
```

### SendError

```typescript
interface SendError extends Error {
  code: string;
  statusCode?: number;
  transportId: string;
  retryable: boolean;
}
```

### Transport

```typescript
interface Transport {
  id: string;
  send(message: EmailMessage): Promise<SendResult>;
}
```

---

## Core Classes

### Mailer

```typescript
class Mailer {
  constructor(transport: Transport, options?: MailerOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```

**MailerOptions:**

```typescript
interface MailerOptions {
  dryRun?: boolean;
  inlineCss?: boolean;
  onSend?: (message: EmailMessage, result: SendResult) => void | Promise<void>;
  onError?: (message: EmailMessage, error: SendError) => void | Promise<void>;
}
```

### FailoverMailer

```typescript
class FailoverMailer implements Transport {
  readonly id = "failover";
  constructor(transports: Transport[]);
  send(message: EmailMessage): Promise<SendResult>;
}
```

### createMailer

```typescript
function createMailer(config: MailerConfig): MailerInstance;
```

**MailerConfig:**

```typescript
interface MailerConfig extends MailerOptions {
  providers: Transport[];
  retry?: RetryOptions | false;
  failover?: boolean;
  rateLimit?: RateLimiterOptions;
  queue?: QueueOptions;
  circuitBreaker?: CircuitBreakerOptions;
  metrics?: boolean;
}
```

**MailerInstance:**

```typescript
interface MailerInstance {
  send(message: EmailMessage): Promise<SendResult>;
  transport: Transport;
  destroy?(): Promise<void>;
  metrics?: MetricsCollector;
  queue?: MailQueue;
  circuitBreaker?: CircuitBreaker;
}
```

---

## Middleware

### withRetry

```typescript
function withRetry(transport: Transport, options?: Partial<RetryOptions>): Transport;
```

**RetryOptions:**

```typescript
interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
  retryOn?: (error: SendError) => boolean;
}
```

### withRateLimiter

```typescript
function withRateLimiter(transport: Transport, options: RateLimiterOptions): Transport;
```

**RateLimiterOptions:**

```typescript
interface RateLimiterOptions {
  maxPerSecond: number;
  maxPerMinute?: number;
}
```

### MailQueue

```typescript
class MailQueue implements Transport {
  readonly id: string;
  constructor(transport: Transport, options: QueueOptions);
  send(message: EmailMessage): Promise<SendResult>;
  readonly size: number;
  readonly active: number;
  close(): Promise<void>;
}
```

**QueueOptions:**

```typescript
interface QueueOptions {
  concurrency: number;
  maxSize?: number;
}
```

### CircuitBreaker

```typescript
class CircuitBreaker implements Transport {
  readonly id: string;
  constructor(transport: Transport, options: CircuitBreakerOptions);
  send(message: EmailMessage): Promise<SendResult>;
  getState(): CircuitState;
  reset(): void;
  readonly failures: number;
}
```

**CircuitBreakerOptions:**

```typescript
interface CircuitBreakerOptions {
  failureThreshold: number;
  halfOpenAfter?: number;
}
```

**CircuitState:** `"closed" | "open" | "half-open"`

### MetricsCollector

```typescript
class MetricsCollector implements Transport {
  readonly id: string;
  constructor(transport: Transport);
  send(message: EmailMessage): Promise<SendResult>;
  snapshot(): MetricsSnapshot;
  reset(): void;
}
```

**MetricsSnapshot:**

```typescript
interface MetricsSnapshot {
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

## Utilities

### createSendError

```typescript
function createSendError(
  message: string,
  transportId: string,
  options?: {
    code?: string;
    statusCode?: number;
    retryable?: boolean;
    cause?: Error;
  }
): SendError;
```

### DKIM

```typescript
async function signMessage(rawMessage: string, options: DkimOptions): Promise<string>;
function createDkimSigner(options: DkimOptions): (rawMessage: string) => Promise<string>;
```

**DkimOptions:**

```typescript
interface DkimOptions {
  domain: string;
  selector: string;
  privateKey: string;
  headers?: string[];
}
```

### CSS Inliner

```typescript
function inlineCss(html: string): string;
```

### Templates

```typescript
function compile(template: string, data: TemplateData, options?: TemplateOptions): string;
function compileMessage(message: EmailMessage, data: TemplateData, options?: TemplateOptions): EmailMessage;
```

**TemplateData:** `Record<string, string | number | boolean | null | undefined>`

**TemplateOptions:**

```typescript
interface TemplateOptions {
  openDelimiter?: string;
  closeDelimiter?: string;
  defaultValue?: string;
}
```

### MIME

```typescript
async function encodeMessage(message: EmailMessage): Promise<string>;
async function buildRawMime(message: EmailMessage): Promise<string>;
```

### Validation

```typescript
function validateMessage(msg: unknown): EmailMessage;
```

### Runtime

```typescript
function detectRuntime(): Runtime;
function supportsNodeModules(): boolean;
function supportsFetch(): boolean;
function supportsCrypto(): boolean;
```

**Runtime:** `"node" | "bun" | "deno" | "workerd" | "edge" | "unknown"`

### Webhooks

```typescript
async function verifyWebhook(
  provider: WebhookProvider,
  secret: string,
  headers: Record<string, string>,
  body: string
): Promise<WebhookVerificationResult>;

function parseWebhookEvent(provider: WebhookProvider, body: string): WebhookEvent;
```

**WebhookProvider:** `"resend" | "sendgrid" | "postmark" | "mailgun"`

### Dev Sandbox

```typescript
class DevSandbox implements Transport {
  constructor(options?: DevSandboxOptions);
  send(message: EmailMessage): Promise<SendResult>;
  getIntercepted(): InterceptedEmail[];
  getLast(): InterceptedEmail | undefined;
  getById(id: string): InterceptedEmail | undefined;
  clear(): void;
  count(): number;
  toHtmlPreview(id: string): string | null;
  toListHtml(): string;
}
```

### Sorting

```typescript
function sortProviders(providers: Transport[], priorities?: Record<string, number>): Transport[];
```

---

## Providers

### SmtpTransport

```typescript
class SmtpTransport implements Transport {
  readonly id = "smtp";
  constructor(options: SmtpTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
  destroy(): Promise<void>;
}
```

### ResendTransport

```typescript
class ResendTransport implements Transport {
  readonly id = "resend";
  constructor(options: ResendTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```

### SendGridTransport

```typescript
class SendGridTransport implements Transport {
  readonly id = "sendgrid";
  constructor(options: SendGridTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```

### PostmarkTransport

```typescript
class PostmarkTransport implements Transport {
  readonly id = "postmark";
  constructor(options: PostmarkTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```

### SesTransport

```typescript
class SesTransport implements Transport {
  readonly id = "ses";
  constructor(options: SesTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```

### MailgunTransport

```typescript
class MailgunTransport implements Transport {
  readonly id = "mailgun";
  constructor(options: MailgunTransportOptions);
  send(message: EmailMessage): Promise<SendResult>;
}
```
