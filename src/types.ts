export type EmailRecipient = string | { name: string; address: string };

export interface Attachment {
  filename: string;
  content?: string | Buffer | Uint8Array | ReadableStream<Uint8Array>;
  path?: string;
  contentType?: string;
  cid?: string;
}

export interface EmailMessage {
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

export interface SendResult {
  messageId: string;
  transportId: string;
  timestamp: Date;
  rawMime?: string;
}

export interface SendError extends Error {
  code: string;
  statusCode?: number;
  transportId: string;
  retryable: boolean;
}

export interface Transport {
  id: string;
  send(message: EmailMessage): Promise<SendResult>;
}
