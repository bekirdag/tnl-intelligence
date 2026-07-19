import type { WebhookEventEnvelope } from './generated/events.js';

export interface OutboxRecord {
  id: string;
  uniqueKey: string;
  event: WebhookEventEnvelope;
  state: 'pending' | 'leased' | 'queued';
  createdAt: number;
  leaseOwner?: string;
  leaseUntil?: number;
  queuedAt?: number;
}

export interface OutboxTransaction {
  appendUnique(record: OutboxRecord): Promise<boolean>;
}

export interface OutboxStore extends OutboxTransaction {
  lease(owner: string, now: number, leaseMs: number, limit: number): Promise<OutboxRecord[]>;
  markQueued(id: string, owner: string, now: number): Promise<void>;
  reconcile(now: number): Promise<OutboxRecord[]>;
}

export class InMemoryOutboxStore implements OutboxStore {
  readonly records = new Map<string, OutboxRecord>();
  readonly #uniqueKeys = new Set<string>();

  async appendUnique(record: OutboxRecord): Promise<boolean> {
    if (this.#uniqueKeys.has(record.uniqueKey)) return false;
    this.#uniqueKeys.add(record.uniqueKey);
    this.records.set(record.id, structuredClone(record));
    return true;
  }

  async lease(owner: string, now: number, leaseMs: number, limit: number): Promise<OutboxRecord[]> {
    const selected = [...this.records.values()]
      .filter(
        (record) =>
          record.state === 'pending' ||
          (record.state === 'leased' && (record.leaseUntil ?? 0) <= now),
      )
      .sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id))
      .slice(0, limit);
    for (const record of selected) {
      record.state = 'leased';
      record.leaseOwner = owner;
      record.leaseUntil = now + leaseMs;
      this.records.set(record.id, structuredClone(record));
    }
    return selected.map((record) => structuredClone(record));
  }

  async markQueued(id: string, owner: string, now: number): Promise<void> {
    const record = this.records.get(id);
    if (!record || record.state !== 'leased' || record.leaseOwner !== owner)
      throw new Error('outbox lease lost');
    record.state = 'queued';
    record.queuedAt = now;
    delete record.leaseOwner;
    delete record.leaseUntil;
    this.records.set(id, structuredClone(record));
  }

  async reconcile(now: number): Promise<OutboxRecord[]> {
    return [...this.records.values()]
      .filter(
        (record) =>
          record.state === 'pending' ||
          (record.state === 'leased' && (record.leaseUntil ?? 0) <= now),
      )
      .map((record) => structuredClone(record));
  }
}

export class WebhookProducer {
  constructor(readonly enabled = false) {}

  async stage(transaction: OutboxTransaction, event: WebhookEventEnvelope): Promise<boolean> {
    if (!this.enabled) return false;
    return transaction.appendUnique({
      id: `out_${event.id.slice(4)}`,
      uniqueKey: `${event.tenantId}\u0000${event.resource.id}\u0000${event.resource.revision}\u0000${event.type}`,
      event: structuredClone(event),
      state: 'pending',
      createdAt: Date.parse(event.publishedAt),
    });
  }
}
