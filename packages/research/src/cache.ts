import { createHash } from 'node:crypto';
import type { ResearchResult, ResearchTask, ResearchSkillManifest } from './contracts.js';

interface CacheEntry {
  result: ResearchResult;
  expiresAt: number;
  revisions: Map<string, string>;
}

export class TenantResearchCache {
  private readonly entries = new Map<string, CacheEntry>();

  get(
    tenantId: string,
    task: ResearchTask,
    skill: ResearchSkillManifest,
    now = Date.now(),
  ): ResearchResult | undefined {
    const key = cacheKey(tenantId, task, skill);
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.result);
  }

  set(
    tenantId: string,
    task: ResearchTask,
    skill: ResearchSkillManifest,
    result: ResearchResult,
    now = Date.now(),
  ): void {
    const revisions = new Map(
      result.evidence
        .filter((item) => item.resourceId)
        .map((item) => [item.resourceId as string, item.revision ?? item.contentHash]),
    );
    this.entries.set(cacheKey(tenantId, task, skill), {
      result: structuredClone(result),
      expiresAt: now + Math.min(task.sourcePolicy.freshnessMs, 86_400_000),
      revisions,
    });
  }

  invalidateResource(resourceId: string, revision?: string): number {
    let removed = 0;
    for (const [key, entry] of this.entries) {
      const current = entry.revisions.get(resourceId);
      if (current !== undefined && (revision === undefined || current !== revision)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }

  clearTenant(tenantId: string): number {
    let removed = 0;
    for (const key of this.entries.keys()) {
      if (key.startsWith(`${tenantId}:`)) {
        this.entries.delete(key);
        removed += 1;
      }
    }
    return removed;
  }
}

function cacheKey(tenantId: string, task: ResearchTask, skill: ResearchSkillManifest): string {
  const normalized = {
    taskType: task.taskType,
    question: task.question.trim().toLowerCase(),
    asOf: task.asOf,
    timeWindow: task.timeWindow,
    selectedStoryIds: [...(task.selectedStoryIds ?? [])].sort(),
    entities: [...(task.entities ?? [])].sort(),
    geographies: [...(task.geographies ?? [])].sort(),
    categories: [...(task.categories ?? [])].sort(),
    assets: [...(task.assets ?? [])].sort(),
    scenarios: [...(task.scenarios ?? [])].sort(),
    depth: task.depth,
    sourcePolicy: task.sourcePolicy,
    skillVersion: skill.version,
  };
  return `${tenantId}:${createHash('sha256').update(JSON.stringify(normalized)).digest('hex')}`;
}
