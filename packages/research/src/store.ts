import type { ResearchResult } from './contracts.js';

interface StoredResult {
  tenantId: string;
  ownerId: string;
  result: ResearchResult;
  createdAt: number;
  expiresAt: number;
}

export interface ResearchResultStore {
  save(tenantId: string, ownerId: string, result: ResearchResult): Promise<void>;
  get(tenantId: string, resultId: string): Promise<ResearchResult | undefined>;
  delete(tenantId: string, ownerId: string, resultId: string): Promise<boolean>;
  prune(now?: number): Promise<number>;
}

export class InMemoryResearchResultStore implements ResearchResultStore {
  private readonly results = new Map<string, StoredResult>();

  constructor(private readonly retentionMs = 7 * 86_400_000) {}

  async save(tenantId: string, ownerId: string, result: ResearchResult): Promise<void> {
    const createdAt = Date.now();
    this.results.set(key(tenantId, result.resultId), {
      tenantId,
      ownerId,
      result: structuredClone(result),
      createdAt,
      expiresAt: createdAt + this.retentionMs,
    });
  }

  async get(tenantId: string, resultId: string): Promise<ResearchResult | undefined> {
    const stored = this.results.get(key(tenantId, resultId));
    if (!stored || stored.expiresAt <= Date.now()) {
      if (stored) this.results.delete(key(tenantId, resultId));
      return undefined;
    }
    return structuredClone(stored.result);
  }

  async delete(tenantId: string, ownerId: string, resultId: string): Promise<boolean> {
    const stored = this.results.get(key(tenantId, resultId));
    if (!stored || stored.ownerId !== ownerId) return false;
    return this.results.delete(key(tenantId, resultId));
  }

  async prune(now = Date.now()): Promise<number> {
    let removed = 0;
    for (const [storageKey, stored] of this.results) {
      if (stored.expiresAt <= now) {
        this.results.delete(storageKey);
        removed += 1;
      }
    }
    return removed;
  }
}

function key(tenantId: string, resultId: string): string {
  return `${tenantId}:${resultId}`;
}
