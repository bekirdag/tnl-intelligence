export type WebhookMetric =
  | 'outbox_relayed'
  | 'delivery_attempted'
  | 'delivery_succeeded'
  | 'delivery_retried'
  | 'delivery_terminal'
  | 'delivery_dead_lettered'
  | 'delivery_replayed'
  | 'destination_blocked';

export class WebhookMetrics {
  readonly #counters = new Map<WebhookMetric, number>();
  readonly #latencies: number[] = [];

  increment(metric: WebhookMetric, amount = 1): void {
    this.#counters.set(metric, (this.#counters.get(metric) ?? 0) + amount);
  }

  observeLatency(milliseconds: number): void {
    if (Number.isFinite(milliseconds) && milliseconds >= 0) {
      this.#latencies.push(milliseconds);
      if (this.#latencies.length > 1_000) this.#latencies.shift();
    }
  }

  snapshot(): { counters: Record<string, number>; latencyP95Ms: number } {
    const sorted = [...this.#latencies].sort((left, right) => left - right);
    const index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);
    return {
      counters: Object.fromEntries(this.#counters),
      latencyP95Ms: sorted[index] ?? 0,
    };
  }

  prometheus(queueDepth = 0, oldestQueuedAgeSeconds = 0): string {
    const lines = [...this.#counters.entries()].map(
      ([name, value]) => `tnl_webhook_${name}_total ${value}`,
    );
    lines.push(`tnl_webhook_queue_depth ${Math.max(0, queueDepth)}`);
    lines.push(`tnl_webhook_oldest_queued_age_seconds ${Math.max(0, oldestQueuedAgeSeconds)}`);
    lines.push(`tnl_webhook_delivery_latency_p95_ms ${this.snapshot().latencyP95Ms}`);
    return `${lines.join('\n')}\n`;
  }
}
