export type {
  EmailMessage,
  EmailRecipient,
  Attachment,
  SendResult,
  SendError,
  Transport,
} from "./types.js";

export { Mailer, createSendError } from "./transport.js";
export type { MailerOptions } from "./transport.js";
export { FailoverMailer } from "./failover.js";
export { withRetry } from "./retry.js";
export { encodeMessage, buildRawMime } from "./mime.js";
export { validateMessage } from "./validation.js";
export {
  generateBoundary,
  CRLF,
  foldAddress,
  foldRecipients,
  encodeBase64Lines,
  guessMimeType,
} from "./utils.js";

export { signMessage, createDkimSigner } from "./dkim.js";
export type { DkimOptions } from "./dkim.js";

export { createMailer, sortProviders } from "./registry.js";
export type { MailerConfig, MailerInstance, ProviderEntry } from "./registry.js";

export { detectRuntime, supportsNodeModules, supportsFetch, supportsCrypto } from "./runtime.js";
export type { Runtime } from "./runtime.js";

export { inlineCss } from "./css-inliner.js";

export { compile, compileMessage } from "./template.js";
export type { TemplateData, TemplateOptions } from "./template.js";

export { DevSandbox } from "./dev-sandbox.js";
export type { InterceptedEmail, DevSandboxOptions } from "./dev-sandbox.js";

export { verifyWebhook, parseWebhookEvent } from "./webhook.js";
export type { WebhookProvider, WebhookVerificationResult, WebhookEvent } from "./webhook.js";
