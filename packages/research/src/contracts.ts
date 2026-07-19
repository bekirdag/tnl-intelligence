export const RESEARCH_SCHEMA_VERSION = '1.0' as const;
export const TNL_BOT_PROFILE_URL = 'https://theneuralledger.com/about/tnl-bot' as const;

export const RESEARCH_TASK_TYPES = [
  'what_changed',
  'source_comparison',
  'event_validation',
  'asset_entity_exposure',
  'geopolitical_operational_risk',
  'weekly_consequential',
] as const;

export type ResearchTaskType = (typeof RESEARCH_TASK_TYPES)[number];
export type ResearchDepth = 'brief' | 'standard' | 'deep';
export type ResearchTool = 'tnl' | 'docdex' | 'web' | 'codali';
export type ClaimClassification = 'fact' | 'inference' | 'forecast' | 'unknown';
export type EvidenceRelationship = 'supports' | 'contradicts' | 'context';
export type CompletionReason =
  | 'complete'
  | 'partial'
  | 'budget_exhausted'
  | 'cancelled'
  | 'insufficient_evidence'
  | 'failed';

export interface ResearchBudget {
  maxToolCalls: number;
  maxDurationMs: number;
  maxInputTokens: number;
  maxOutputTokens: number;
  maxSources: number;
  maxCostUsd: number;
}

export interface BudgetUsage {
  toolCalls: number;
  durationMs: number;
  inputTokens: number;
  outputTokens: number;
  sources: number;
  costUsd: number;
}

export interface SourcePolicy {
  version: string;
  requirePrimary: boolean;
  minimumIndependentSources: number;
  freshnessMs: number;
  allowedDomains?: string[];
  deniedDomains?: string[];
}

export interface ResearchTask {
  schemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  taskId: string;
  taskType: ResearchTaskType;
  question: string;
  asOf: string;
  timeWindow: { from: string; to: string };
  selectedStoryIds?: string[];
  entities?: string[];
  geographies?: string[];
  categories?: string[];
  assets?: string[];
  scenarios?: string[];
  depth: ResearchDepth;
  sourcePolicy: SourcePolicy;
  budget: ResearchBudget;
  outputFormat: 'json' | 'markdown';
  locale: string;
}

export interface RawEvidence {
  sourceType: 'tnl' | 'docdex' | 'web';
  title: string;
  publisher: string;
  author?: string;
  url?: string;
  resourceId?: string;
  excerpt?: string;
  statement: string;
  retrievedAt: string;
  eventAt?: string;
  publishedAt?: string;
  revisedAt?: string;
  revision?: string;
  primary: boolean;
  reliability: number;
  accessState?: 'available' | 'paywalled' | 'removed' | 'retracted';
}

export interface EvidenceItem extends RawEvidence {
  evidenceId: string;
  canonicalUrl?: string;
  contentHash: string;
  relationships: Array<{ claimId: string; relationship: EvidenceRelationship }>;
  injectionSignals: string[];
  freshness: 'fresh' | 'stale' | 'unknown';
}

export interface ResearchClaim {
  claimId: string;
  statement: string;
  classification: ClaimClassification;
  supportingEvidenceIds: string[];
  contradictingEvidenceIds: string[];
  confidence: number;
  validFrom?: string;
  validUntil?: string;
  freshness: 'fresh' | 'stale' | 'unknown';
  materiality: number;
  impactHorizon?: string;
}

export interface TimelineEntry {
  timestamp: string;
  kind: 'event' | 'publication' | 'revision' | 'retrieval';
  label: string;
  evidenceIds: string[];
}

export interface ImpactPath {
  pathId: string;
  nodes: string[];
  relationship: 'documented' | 'inferred' | 'scenario';
  horizon: string;
  supportingEvidenceIds: string[];
  counterfactors: string[];
}

export interface ResearchTraceStage {
  stage: 'plan' | 'retrieve' | 'normalize' | 'synthesize' | 'grade' | 'cache';
  tools: ResearchTool[];
  status: 'complete' | 'partial' | 'skipped' | 'failed';
  durationMs: number;
  summary: string;
}

export interface GraderResult {
  grader: 'schema' | 'citations' | 'unsupported_claims' | 'contradictions' | 'freshness' | 'safety';
  score: number;
  passed: boolean;
  details: string;
}

export interface ResearchResult {
  schemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  resultId: string;
  taskId: string;
  taskType: ResearchTaskType;
  skill: { id: string; version: string };
  directAnswer: string;
  executiveSummary: string;
  claims: ResearchClaim[];
  evidence: EvidenceItem[];
  contradictions: string[];
  unknowns: string[];
  assumptions: string[];
  timeline: TimelineEntry[];
  impactPaths: ImpactPath[];
  citations: Array<{ evidenceId: string; label: string; url?: string }>;
  trace: ResearchTraceStage[];
  graders: GraderResult[];
  budget: { limit: ResearchBudget; used: BudgetUsage };
  completionReason: CompletionReason;
  warnings: string[];
  asOf: string;
  lastCheckedAt: string;
  automatedAuthor: { name: 'TNL Bot'; profileUrl: typeof TNL_BOT_PROFILE_URL };
  orchestration: { provider: string; version: string };
}

export interface ResearchSkillManifest {
  id: string;
  name: string;
  description: string;
  owners: string[];
  version: string;
  taskType: ResearchTaskType;
  taskSchemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  resultSchemaVersion: typeof RESEARCH_SCHEMA_VERSION;
  requiredTools: ResearchTool[];
  optionalTools: ResearchTool[];
  defaultBudget: ResearchBudget;
  maximumBudget: ResearchBudget;
  sourcePolicy: SourcePolicy;
  graders: GraderResult['grader'][];
  thresholds: Record<string, number>;
  evaluationDatasetVersion: string;
  knownFailureModes: string[];
  fallback: string;
  changelog: string[];
}

export interface SynthesisDraft {
  directAnswer: string;
  executiveSummary: string;
  claims: Omit<ResearchClaim, 'freshness'>[];
  contradictions: string[];
  unknowns: string[];
  assumptions: string[];
  impactPaths: ImpactPath[];
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  provider: string;
  version: string;
}

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{2,127}$/;
const MAX_QUESTION_LENGTH = 8_000;

export function validateResearchTask(value: unknown): asserts value is ResearchTask {
  if (!value || typeof value !== 'object') throw new TypeError('Research task must be an object');
  const task = value as Partial<ResearchTask>;
  if (task.schemaVersion !== RESEARCH_SCHEMA_VERSION)
    throw new TypeError(`Unsupported research schema version: ${String(task.schemaVersion)}`);
  if (!task.taskId || !ID_PATTERN.test(task.taskId))
    throw new TypeError('Invalid research task id');
  if (!task.taskType || !RESEARCH_TASK_TYPES.includes(task.taskType))
    throw new TypeError('Invalid research task type');
  if (
    !task.question ||
    task.question.trim().length < 3 ||
    task.question.length > MAX_QUESTION_LENGTH
  )
    throw new TypeError('Research question must contain 3 to 8000 characters');
  if (
    !isIso(task.asOf) ||
    !task.timeWindow ||
    !isIso(task.timeWindow.from) ||
    !isIso(task.timeWindow.to)
  )
    throw new TypeError('Research task timestamps must be ISO 8601 values');
  if (Date.parse(task.timeWindow.from) > Date.parse(task.timeWindow.to))
    throw new TypeError('Research time window is reversed');
  if (Date.parse(task.timeWindow.to) > Date.parse(task.asOf))
    throw new TypeError('Research time window cannot end after asOf');
  if (!['brief', 'standard', 'deep'].includes(task.depth ?? ''))
    throw new TypeError('Invalid research depth');
  if (!['json', 'markdown'].includes(task.outputFormat ?? ''))
    throw new TypeError('Invalid research output format');
  if (!task.locale || task.locale.length > 35) throw new TypeError('Invalid research locale');
  validateBudget(task.budget);
  if (!task.sourcePolicy || !task.sourcePolicy.version)
    throw new TypeError('A versioned source policy is required');
}

export function validateResearchResult(value: ResearchResult): void {
  if (value.schemaVersion !== RESEARCH_SCHEMA_VERSION || !ID_PATTERN.test(value.resultId))
    throw new TypeError('Invalid research result identity');
  const evidenceIds = new Set(value.evidence.map((item) => item.evidenceId));
  for (const claim of value.claims) {
    if (!ID_PATTERN.test(claim.claimId) || claim.confidence < 0 || claim.confidence > 1)
      throw new TypeError(`Invalid research claim ${claim.claimId}`);
    for (const evidenceId of [...claim.supportingEvidenceIds, ...claim.contradictingEvidenceIds]) {
      if (!evidenceIds.has(evidenceId))
        throw new TypeError(`Claim ${claim.claimId} references missing evidence ${evidenceId}`);
    }
  }
}

export function clampBudget(requested: ResearchBudget, maximum: ResearchBudget): ResearchBudget {
  return {
    maxToolCalls: Math.min(requested.maxToolCalls, maximum.maxToolCalls),
    maxDurationMs: Math.min(requested.maxDurationMs, maximum.maxDurationMs),
    maxInputTokens: Math.min(requested.maxInputTokens, maximum.maxInputTokens),
    maxOutputTokens: Math.min(requested.maxOutputTokens, maximum.maxOutputTokens),
    maxSources: Math.min(requested.maxSources, maximum.maxSources),
    maxCostUsd: Math.min(requested.maxCostUsd, maximum.maxCostUsd),
  };
}

function validateBudget(value: ResearchBudget | undefined): void {
  if (!value) throw new TypeError('Research budget is required');
  const fields: Array<keyof ResearchBudget> = [
    'maxToolCalls',
    'maxDurationMs',
    'maxInputTokens',
    'maxOutputTokens',
    'maxSources',
    'maxCostUsd',
  ];
  for (const field of fields) {
    if (!Number.isFinite(value[field]) || value[field] < 0)
      throw new TypeError(`Invalid research budget field ${field}`);
  }
}

function isIso(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}
