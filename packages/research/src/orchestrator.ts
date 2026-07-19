import { createHash } from 'node:crypto';
import type {
  CompletionReason,
  EvidenceItem,
  ResearchClaim,
  ResearchResult,
  ResearchTask,
  ResearchTraceStage,
  SynthesisDraft,
} from './contracts.js';
import {
  RESEARCH_SCHEMA_VERSION,
  TNL_BOT_PROFILE_URL,
  clampBudget,
  validateResearchResult,
  validateResearchTask,
} from './contracts.js';
import type { CodaliAdapter, EvidenceAdapter } from './adapters.js';
import { ToolUnavailableError } from './adapters.js';
import { ResearchBudgetExceededError, ResearchBudgetTracker } from './budget.js';
import { TenantResearchCache } from './cache.js';
import { buildTimeline, normalizeEvidence, safeEvidenceForSynthesis } from './evidence.js';
import { gradeResearchResult } from './graders.js';
import { getResearchSkill } from './manifests.js';

export interface ResearchOrchestratorOptions {
  adapters: EvidenceAdapter[];
  codali: CodaliAdapter;
  cache?: TenantResearchCache;
  now?: () => Date;
}

export interface ResearchRunContext {
  tenantId: string;
  actorId: string;
  requestId?: string;
}

export class ResearchOrchestrator {
  private readonly adapters: Map<EvidenceAdapter['tool'], EvidenceAdapter>;
  private readonly cache: TenantResearchCache;
  private readonly now: () => Date;

  constructor(private readonly options: ResearchOrchestratorOptions) {
    this.adapters = new Map(options.adapters.map((adapter) => [adapter.tool, adapter]));
    this.cache = options.cache ?? new TenantResearchCache();
    this.now = options.now ?? (() => new Date());
  }

  async run(
    context: ResearchRunContext,
    taskValue: ResearchTask,
    signal?: AbortSignal,
  ): Promise<ResearchResult> {
    validateContext(context);
    validateResearchTask(taskValue);
    const skill = getResearchSkill(taskValue.taskType);
    const task = structuredClone(taskValue);
    task.budget = clampBudget(task.budget, skill.maximumBudget);
    const tracker = new ResearchBudgetTracker(task.budget);
    const trace: ResearchTraceStage[] = [];
    const warnings: string[] = [];
    const now = this.now();
    const recent = now.getTime() - Date.parse(task.asOf) <= task.sourcePolicy.freshnessMs;
    if (!recent) {
      const cached = this.cache.get(context.tenantId, task, skill, now.getTime());
      if (cached) {
        cached.trace.push({
          stage: 'cache',
          tools: [],
          status: 'complete',
          durationMs: 0,
          summary: 'Returned a tenant-scoped result whose historical asOf window is immutable.',
        });
        return cached;
      }
    }

    trace.push({
      stage: 'plan',
      tools: [...skill.requiredTools, ...skill.optionalTools],
      status: 'complete',
      durationMs: 0,
      summary: `Selected ${skill.id}@${skill.version}; TNL retrieval is evaluated before corroborating sources.`,
    });

    try {
      signal?.throwIfAborted();
      const raw = [] as Awaited<ReturnType<EvidenceAdapter['retrieve']>>;
      const retrievalStart = Date.now();
      for (const tool of ['tnl', 'docdex', 'web'] as const) {
        if (!skill.requiredTools.includes(tool) && !skill.optionalTools.includes(tool)) continue;
        const adapter = this.adapters.get(tool);
        const required = skill.requiredTools.includes(tool);
        if (!adapter || !(await adapter.available())) {
          warnings.push(
            `${tool} retrieval was unavailable${required ? ' and is required by this skill' : ''}.`,
          );
          continue;
        }
        tracker.beforeTool(tool);
        try {
          const retrieved = await adapter.retrieve(task, signal);
          tracker.consume({ sources: retrieved.length });
          raw.push(...retrieved);
        } catch (error) {
          if (required) warnings.push(`${tool} retrieval failed: ${safeError(error)}`);
          else warnings.push(`Optional ${tool} retrieval failed and was skipped.`);
        }
      }
      trace.push({
        stage: 'retrieve',
        tools: ['tnl', 'docdex', 'web'].filter((tool) =>
          this.adapters.has(tool as EvidenceAdapter['tool']),
        ) as Array<'tnl' | 'docdex' | 'web'>,
        status: warnings.length ? 'partial' : 'complete',
        durationMs: Date.now() - retrievalStart,
        summary: `Retrieved ${raw.length} bounded source record(s); source bodies are not persisted in the trace.`,
      });

      const normalizationStart = Date.now();
      const evidence = normalizeEvidence(raw, task, now.getTime()).slice(0, task.budget.maxSources);
      trace.push({
        stage: 'normalize',
        tools: [],
        status: 'complete',
        durationMs: Date.now() - normalizationStart,
        summary: `Normalized and deduplicated ${evidence.length} evidence item(s); ${evidence.filter((item) => item.injectionSignals.length > 0).length} untrusted instruction payload(s) were quarantined.`,
      });

      const synthesisStart = Date.now();
      const codaliAvailable = await this.options.codali.available();
      let draft: SynthesisDraft;
      if (codaliAvailable) {
        tracker.beforeTool('codali');
        draft = await this.options.codali.synthesize({
          task,
          skill,
          evidence: evidence.map(safeEvidenceForSynthesis),
          ...(signal ? { signal } : {}),
        });
      } else {
        warnings.push('Codali was unavailable; the result uses evidence-only degraded synthesis.');
        draft = degradedDraft(task, evidence);
      }
      tracker.consume({
        inputTokens: draft.inputTokens,
        outputTokens: draft.outputTokens,
        costUsd: draft.costUsd,
      });
      trace.push({
        stage: 'synthesize',
        tools: codaliAvailable ? ['codali'] : [],
        status: codaliAvailable ? 'complete' : 'partial',
        durationMs: Date.now() - synthesisStart,
        summary: codaliAvailable
          ? `Synthesis completed with ${draft.provider}@${draft.version}; hidden reasoning was not retained.`
          : 'Built a deterministic evidence-only answer because Codali was unavailable.',
      });

      const claims = normalizeClaims(draft.claims, evidence);
      linkEvidence(claims, evidence);
      const result = buildResult(
        task,
        skill.id,
        skill.version,
        evidence,
        claims,
        draft,
        trace,
        warnings,
        tracker,
        now,
      );
      const graderStart = Date.now();
      result.graders = gradeResearchResult(result);
      result.trace.push({
        stage: 'grade',
        tools: [],
        status: result.graders.every((item) => item.passed) ? 'complete' : 'partial',
        durationMs: Date.now() - graderStart,
        summary: `${result.graders.filter((item) => item.passed).length}/${result.graders.length} deterministic graders passed.`,
      });
      result.completionReason = completionReason(task, result, codaliAvailable, warnings);
      validateResearchResult(result);
      if (result.completionReason === 'complete')
        this.cache.set(context.tenantId, task, skill, result, now.getTime());
      return result;
    } catch (error) {
      if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError'))
        return terminalResult(
          task,
          skill.id,
          skill.version,
          trace,
          tracker,
          now,
          'cancelled',
          'Research run was cancelled.',
        );
      if (error instanceof ResearchBudgetExceededError)
        return terminalResult(
          task,
          skill.id,
          skill.version,
          trace,
          tracker,
          now,
          'budget_exhausted',
          error.message,
        );
      if (error instanceof ToolUnavailableError)
        return terminalResult(
          task,
          skill.id,
          skill.version,
          trace,
          tracker,
          now,
          'partial',
          error.message,
        );
      throw error;
    }
  }

  invalidateResource(resourceId: string, revision?: string): number {
    return this.cache.invalidateResource(resourceId, revision);
  }
}

function buildResult(
  task: ResearchTask,
  skillId: string,
  skillVersion: string,
  evidence: EvidenceItem[],
  claims: ResearchClaim[],
  draft: SynthesisDraft,
  trace: ResearchTraceStage[],
  warnings: string[],
  tracker: ResearchBudgetTracker,
  now: Date,
): ResearchResult {
  return {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    resultId: resultId(task, skillVersion),
    taskId: task.taskId,
    taskType: task.taskType,
    skill: { id: skillId, version: skillVersion },
    directAnswer: draft.directAnswer.slice(0, 20_000),
    executiveSummary: draft.executiveSummary.slice(0, 10_000),
    claims,
    evidence,
    contradictions: draft.contradictions.slice(0, 100),
    unknowns: draft.unknowns.slice(0, 100),
    assumptions: draft.assumptions.slice(0, 100),
    timeline: buildTimeline(evidence),
    impactPaths: draft.impactPaths.slice(0, 100),
    citations: evidence.map((item, index) => ({
      evidenceId: item.evidenceId,
      label: `${index + 1}. ${item.publisher}: ${item.title}`,
      ...(item.canonicalUrl ? { url: item.canonicalUrl } : {}),
    })),
    trace,
    graders: [],
    budget: { limit: task.budget, used: safeUsage(tracker) },
    completionReason: 'partial',
    warnings,
    asOf: task.asOf,
    lastCheckedAt: now.toISOString(),
    automatedAuthor: { name: 'TNL Bot', profileUrl: TNL_BOT_PROFILE_URL },
    orchestration: { provider: draft.provider, version: draft.version },
  };
}

function normalizeClaims(
  drafts: SynthesisDraft['claims'],
  evidence: EvidenceItem[],
): ResearchClaim[] {
  const ids = new Set(evidence.map((item) => item.evidenceId));
  return drafts.slice(0, 100).map((claim, index) => {
    const support = claim.supportingEvidenceIds.filter((id) => ids.has(id));
    const contradict = claim.contradictingEvidenceIds.filter((id) => ids.has(id));
    const states = support
      .map((id) => evidence.find((item) => item.evidenceId === id)?.freshness)
      .filter(Boolean);
    return {
      ...claim,
      claimId: /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/.test(claim.claimId)
        ? claim.claimId
        : `claim_${index + 1}`,
      statement: claim.statement.trim().slice(0, 5_000),
      supportingEvidenceIds: support,
      contradictingEvidenceIds: contradict,
      confidence: Math.max(0, Math.min(1, claim.confidence)),
      materiality: Math.max(0, Math.min(1, claim.materiality)),
      freshness: states.includes('stale')
        ? 'stale'
        : states.includes('fresh')
          ? 'fresh'
          : 'unknown',
    };
  });
}

function linkEvidence(claims: ResearchClaim[], evidence: EvidenceItem[]): void {
  const byId = new Map(evidence.map((item) => [item.evidenceId, item]));
  for (const claim of claims) {
    for (const evidenceId of claim.supportingEvidenceIds)
      byId
        .get(evidenceId)
        ?.relationships.push({ claimId: claim.claimId, relationship: 'supports' });
    for (const evidenceId of claim.contradictingEvidenceIds)
      byId
        .get(evidenceId)
        ?.relationships.push({ claimId: claim.claimId, relationship: 'contradicts' });
  }
}

function degradedDraft(task: ResearchTask, evidence: EvidenceItem[]): SynthesisDraft {
  const usable = evidence.filter(
    (item) => item.injectionSignals.length === 0 && item.accessState !== 'retracted',
  );
  return {
    directAnswer: usable.length
      ? `A complete synthesized answer is unavailable. ${usable.length} evidence item(s) can be inspected for ${task.question.trim()}`
      : 'No usable evidence was available for this research run.',
    executiveSummary: usable
      .slice(0, 3)
      .map((item) => item.statement)
      .join(' '),
    claims: usable.slice(0, 5).map((item, index) => ({
      claimId: `claim_${index + 1}`,
      statement: item.statement,
      classification: 'fact',
      supportingEvidenceIds: [item.evidenceId],
      contradictingEvidenceIds: [],
      confidence: item.reliability,
      materiality: 0.5,
    })),
    contradictions: [],
    unknowns: ['Codali synthesis was unavailable.'],
    assumptions: ['Only retrieved source statements are represented.'],
    impactPaths: [],
    inputTokens: 0,
    outputTokens: 0,
    costUsd: 0,
    provider: 'evidence-only-degraded',
    version: '1',
  };
}

function completionReason(
  task: ResearchTask,
  result: ResearchResult,
  codaliAvailable: boolean,
  warnings: string[],
): CompletionReason {
  const independentPublishers = new Set(
    result.evidence.map((item) => item.publisher.toLowerCase()),
  );
  if (result.evidence.length === 0) return 'insufficient_evidence';
  if (!codaliAvailable || warnings.some((warning) => warning.includes('required by this skill')))
    return 'partial';
  if (task.sourcePolicy.requirePrimary && !result.evidence.some((item) => item.primary))
    return 'insufficient_evidence';
  if (independentPublishers.size < task.sourcePolicy.minimumIndependentSources) return 'partial';
  if (
    result.graders.some(
      (grader) => ['schema', 'citations', 'safety'].includes(grader.grader) && !grader.passed,
    )
  )
    return 'partial';
  return 'complete';
}

function terminalResult(
  task: ResearchTask,
  skillId: string,
  skillVersion: string,
  trace: ResearchTraceStage[],
  tracker: ResearchBudgetTracker,
  now: Date,
  reason: CompletionReason,
  warning: string,
): ResearchResult {
  const result: ResearchResult = {
    schemaVersion: RESEARCH_SCHEMA_VERSION,
    resultId: resultId(task, skillVersion),
    taskId: task.taskId,
    taskType: task.taskType,
    skill: { id: skillId, version: skillVersion },
    directAnswer: warning,
    executiveSummary: '',
    claims: [],
    evidence: [],
    contradictions: [],
    unknowns: [warning],
    assumptions: [],
    timeline: [],
    impactPaths: [],
    citations: [],
    trace,
    graders: [],
    budget: { limit: task.budget, used: safeUsage(tracker) },
    completionReason: reason,
    warnings: [warning],
    asOf: task.asOf,
    lastCheckedAt: now.toISOString(),
    automatedAuthor: { name: 'TNL Bot', profileUrl: TNL_BOT_PROFILE_URL },
    orchestration: { provider: 'none', version: '0' },
  };
  result.graders = gradeResearchResult(result);
  return result;
}

function resultId(task: ResearchTask, skillVersion: string): string {
  return `res_${createHash('sha256').update(`${task.taskId}:${task.asOf}:${skillVersion}`).digest('hex').slice(0, 24)}`;
}

function safeUsage(tracker: ResearchBudgetTracker) {
  try {
    return tracker.snapshot();
  } catch {
    return { ...tracker.usage };
  }
}

function safeError(error: unknown): string {
  if (error instanceof ToolUnavailableError) return error.message;
  return error instanceof Error
    ? error.message.replace(/(?:bearer|token|secret|api[_ -]?key)\s*[:=]\s*\S+/gi, '[redacted]')
    : 'unknown error';
}

function validateContext(context: ResearchRunContext): void {
  if (!context.tenantId || !context.actorId)
    throw new TypeError('Tenant and actor identity are required');
}
