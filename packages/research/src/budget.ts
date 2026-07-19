import type { BudgetUsage, ResearchBudget, ResearchTool } from './contracts.js';

export class ResearchBudgetExceededError extends Error {
  constructor(readonly dimension: keyof ResearchBudget) {
    super(`Research budget exhausted: ${dimension}`);
    this.name = 'ResearchBudgetExceededError';
  }
}

export class ResearchBudgetTracker {
  readonly startedAt = Date.now();
  readonly usage: BudgetUsage = {
    toolCalls: 0,
    durationMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    sources: 0,
    costUsd: 0,
  };

  constructor(readonly limit: ResearchBudget) {}

  beforeTool(_tool: ResearchTool): void {
    this.refreshDuration();
    if (this.usage.toolCalls + 1 > this.limit.maxToolCalls)
      throw new ResearchBudgetExceededError('maxToolCalls');
    this.usage.toolCalls += 1;
  }

  consume(values: Partial<Omit<BudgetUsage, 'toolCalls' | 'durationMs'>>): void {
    this.usage.inputTokens += values.inputTokens ?? 0;
    this.usage.outputTokens += values.outputTokens ?? 0;
    this.usage.sources += values.sources ?? 0;
    this.usage.costUsd = roundMoney(this.usage.costUsd + (values.costUsd ?? 0));
    this.assertWithinLimits();
  }

  snapshot(): BudgetUsage {
    this.refreshDuration();
    return { ...this.usage };
  }

  private refreshDuration(): void {
    this.usage.durationMs = Date.now() - this.startedAt;
    if (this.usage.durationMs > this.limit.maxDurationMs)
      throw new ResearchBudgetExceededError('maxDurationMs');
  }

  private assertWithinLimits(): void {
    if (this.usage.inputTokens > this.limit.maxInputTokens)
      throw new ResearchBudgetExceededError('maxInputTokens');
    if (this.usage.outputTokens > this.limit.maxOutputTokens)
      throw new ResearchBudgetExceededError('maxOutputTokens');
    if (this.usage.sources > this.limit.maxSources)
      throw new ResearchBudgetExceededError('maxSources');
    if (this.usage.costUsd > this.limit.maxCostUsd)
      throw new ResearchBudgetExceededError('maxCostUsd');
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 1_000_000) / 1_000_000;
}
