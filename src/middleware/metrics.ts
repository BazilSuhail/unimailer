import type { Transport, EmailMessage, SendResult, SendError } from "../types.js";

export interface MetricsSnapshot {
  total: number;
  success: number;
  failure: number;
  latencies: number[];
  errors: Array<{ transportId: string; code: string; timestamp: number }>;
  byTransport: Record<string, { success: number; failure: number; avgLatency: number }>;
}

export class MetricsCollector implements Transport {
  readonly id: string;
  private transport: Transport;
  private total = 0;
  private success = 0;
  private failure = 0;
  private latencies: number[] = [];
  private errors: Array<{ transportId: string; code: string; timestamp: number }> = [];
  private byTransport = new Map<string, { success: number; failure: number; latencies: number[] }>();

  constructor(transport: Transport) {
    this.id = `${transport.id}(metrics)`;
    this.transport = transport;
  }

  async send(message: EmailMessage): Promise<SendResult> {
    const start = Date.now();
    this.total++;

    try {
      const result = await this.transport.send(message);
      const latency = Date.now() - start;
      this.success++;
      this.latencies.push(latency);
      this.recordTransport(result.transportId, true, latency);
      return result;
    } catch (err) {
      const latency = Date.now() - start;
      this.failure++;
      this.latencies.push(latency);
      const sendErr = err as SendError;
      this.errors.push({
        transportId: sendErr.transportId ?? this.transport.id,
        code: sendErr.code ?? "UNKNOWN",
        timestamp: Date.now(),
      });
      this.recordTransport(sendErr.transportId ?? this.transport.id, false, latency);
      throw err;
    }
  }

  private recordTransport(id: string, ok: boolean, latency: number) {
    if (!this.byTransport.has(id)) {
      this.byTransport.set(id, { success: 0, failure: 0, latencies: [] });
    }
    const entry = this.byTransport.get(id)!;
    if (ok) entry.success++;
    else entry.failure++;
    entry.latencies.push(latency);
  }

  snapshot(): MetricsSnapshot {
    const byTransport: Record<string, { success: number; failure: number; avgLatency: number }> = {};
    for (const [id, data] of this.byTransport) {
      byTransport[id] = {
        success: data.success,
        failure: data.failure,
        avgLatency:
          data.latencies.length > 0
            ? data.latencies.reduce((a, b) => a + b, 0) / data.latencies.length
            : 0,
      };
    }
    return {
      total: this.total,
      success: this.success,
      failure: this.failure,
      latencies: [...this.latencies],
      errors: [...this.errors],
      byTransport,
    };
  }

  reset() {
    this.total = 0;
    this.success = 0;
    this.failure = 0;
    this.latencies = [];
    this.errors = [];
    this.byTransport.clear();
  }
}
