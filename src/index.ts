export type {
  EmailMessage,
  EmailRecipient,
  Attachment,
  SendResult,
  SendError,
  Transport,
} from "./types.js";

export { Mailer, createSendError } from "./transport.js";
export { FailoverMailer } from "./failover.js";
export { withRetry } from "./retry.js";
export { encodeMessage, buildRawMime } from "./mime.js";
export {
  validateMessage,
} from "./validation.js";
export {
  generateBoundary,
  CRLF,
  foldAddress,
  foldRecipients,
  encodeBase64Lines,
  guessMimeType,
} from "./utils.js";
