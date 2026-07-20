import type { Transport, EmailMessage, SendResult } from "../types.js";
import { createSendError } from "../transport.js";

export type CircuitState = "closed" | "open" | "half-open";

export interface CircuitBreakerOptions {
  failureThreshold: number;
  halfOpenAfter?: number;
}

export class CircuitBreaker implements Transport {
  readonly id: string;
  private transport: Transport;
  private failureThreshold: number;
  private halfOpenAfter: number;
  private state: CircuitState = "closed";
  private failureCount = 0;
  private lastFailure = 0;
  private successCount = 0;

  constructor(transport: Transport, options: CircuitBreakerOptions) {
    this.id = `${transport.id}(circuit)`;
    this.transport = transport;
    this.failureThreshold = options.failureThreshold;
    this.halfOpenAfter = options.halfOpenAfter ?? 5000;
  }

  getState(): CircuitState {
    if (this.state === "open") {
      if (Date.now() - this.lastFailure >= this.halfOpenAfter) {
        this.state = "half-open";
        this.successCount = 0;
      }
    }
    return this.state;
  }

  get failures() {
    return this.failureCount;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const current = this.getState();
    if (current === "open") {
      throw createSendError(
        `Circuit breaker is open for ${this.transport.id}`,
        this.id,
        { code: "CIRCUIT_OPEN", retryable: false },
      );
    }

    try {
      const result = await this.transport.send(message);
      this.onSuccess();
      return result;
    } catch (err) {
      this.onFailure();
      throw err;
    }
  }

  private onSuccess() {
    if (this.state === "half-open") {
      this.successCount++;
      if (this.successCount >= 2) {
        this.state = "closed";
        this.failureCount = 0;
      }
    } else {
      this.failureCount = 0;
    }
  }

  private onFailure() {
    this.failureCount++;
    this.lastFailure = Date.now();
    if (this.failureCount >= this.failureThreshold) {
      this.state = "open";
    }
  }

  reset() {
    this.state = "closed";
    this.failureCount = 0;
    this.successCount = 0;
  }
}
