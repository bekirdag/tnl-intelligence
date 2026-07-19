import type { WebhookEventEnvelope } from './generated/events.js';
import type { WebhookDispatcher } from './delivery.js';
import type { OutboxStore } from './outbox.js';

export interface EventQueue {
  enqueue(event: WebhookEventEnvelope): Promise<boolean>;
  dequeue(): Promise<WebhookEventEnvelope | undefined>;
  size(): number;
}

export class FairEventQueue implements EventQueue {
  readonly #tenants = new Map<string, WebhookEventEnvelope[]>();
  readonly #order: string[] = [];
  readonly #ids = new Set<string>();

  async enqueue(event: WebhookEventEnvelope): Promise<boolean> {
    if (this.#ids.has(event.id)) return false;
    this.#ids.add(event.id);
    const queue = this.#tenants.get(event.tenantId) ?? [];
    queue.push(structuredClone(event));
    this.#tenants.set(event.tenantId, queue);
    if (!this.#order.includes(event.tenantId)) this.#order.push(event.tenantId);
    return true;
  }

  async dequeue(): Promise<WebhookEventEnvelope | undefined> {
    const tenant = this.#order.shift();
    if (!tenant) return undefined;
    const queue = this.#tenants.get(tenant) as WebhookEventEnvelope[];
    const event = queue.shift() as WebhookEventEnvelope;
    if (queue.length > 0) this.#order.push(tenant);
    else this.#tenants.delete(tenant);
    return structuredClone(event);
  }

  size(): number {
    return [...this.#tenants.values()].reduce((total, queue) => total + queue.length, 0);
  }
}

export class OutboxRelay {
  constructor(
    readonly outbox: OutboxStore,
    readonly queue: EventQueue,
    readonly owner: string,
    readonly leaseMs = 30_000,
  ) {}

  async runOnce(now = Date.now(), limit = 100): Promise<number> {
    const records = await this.outbox.lease(this.owner, now, this.leaseMs, limit);
    for (const record of records) {
      await this.queue.enqueue(record.event);
      await this.outbox.markQueued(record.id, this.owner, now);
    }
    return records.length;
  }
}

export class EventDeliveryWorker {
  constructor(
    readonly queue: EventQueue,
    readonly dispatcher: WebhookDispatcher,
  ) {}

  async runOnce(limit = 100): Promise<{ events: number; deliveries: number }> {
    let events = 0;
    for (; events < limit; events += 1) {
      const event = await this.queue.dequeue();
      if (!event) break;
      await this.dispatcher.fanout(event);
    }
    const deliveries = await this.dispatcher.dispatchDue(limit);
    return { events, deliveries };
  }
}
