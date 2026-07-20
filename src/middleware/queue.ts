import type { Transport, EmailMessage, SendResult } from "../types.js";

export interface QueueOptions {
  concurrency: number;
  maxSize?: number;
}

interface QueueItem {
  message: EmailMessage;
  resolve: (result: SendResult) => void;
  reject: (error: Error) => void;
}

export class MailQueue implements Transport {
  readonly id: string;
  private transport: Transport;
  private concurrency: number;
  private maxSize: number;
  private pending = 0;
  private queue: QueueItem[] = [];
  private closed = false;

  constructor(transport: Transport, options: QueueOptions) {
    this.id = `${transport.id}(queued)`;
    this.transport = transport;
    this.concurrency = options.concurrency;
    this.maxSize = options.maxSize ?? 1000;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    if (this.closed) {
      throw new Error("Queue is closed");
    }
    if (this.queue.length + this.pending >= this.maxSize) {
      throw new Error("Queue is full");
    }
    return new Promise<SendResult>((resolve, reject) => {
      this.queue.push({ message, resolve, reject });
      this.flush();
    });
  }

  private flush() {
    while (this.pending < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!;
      this.pending++;
      this.transport
        .send(item.message)
        .then(item.resolve, item.reject)
        .finally(() => {
          this.pending--;
          this.flush();
        });
    }
  }

  get size() {
    return this.queue.length;
  }

  get active() {
    return this.pending;
  }

  async close(): Promise<void> {
    this.closed = true;
    while (this.pending > 0 || this.queue.length > 0) {
      await new Promise((r) => setTimeout(r, 50));
    }
  }
}
