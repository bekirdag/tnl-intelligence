import type {
  EvidenceItem,
  RawEvidence,
  ResearchSkillManifest,
  ResearchTask,
  ResearchTool,
  SynthesisDraft,
} from './contracts.js';

export interface EvidenceAdapter {
  readonly tool: Exclude<ResearchTool, 'codali'>;
  readonly version: string;
  available(): Promise<boolean>;
  retrieve(task: ResearchTask, signal?: AbortSignal): Promise<RawEvidence[]>;
}

export interface CodaliAdapter {
  readonly tool: 'codali';
  readonly version: string;
  available(): Promise<boolean>;
  synthesize(input: {
    task: ResearchTask;
    skill: ResearchSkillManifest;
    evidence: EvidenceItem[];
    signal?: AbortSignal;
  }): Promise<SynthesisDraft>;
}

export class ToolUnavailableError extends Error {
  constructor(
    readonly tool: ResearchTool,
    message = `${tool} is unavailable`,
  ) {
    super(message);
    this.name = 'ToolUnavailableError';
  }
}

export class DeterministicEvidenceAdapter implements EvidenceAdapter {
  readonly version = 'fixture-1';

  constructor(
    readonly tool: Exclude<ResearchTool, 'codali'>,
    private readonly evidence: readonly RawEvidence[],
  ) {}

  async available(): Promise<boolean> {
    return true;
  }

  async retrieve(task: ResearchTask, signal?: AbortSignal): Promise<RawEvidence[]> {
    signal?.throwIfAborted();
    const from = Date.parse(task.timeWindow.from);
    const to = Date.parse(task.timeWindow.to);
    return this.evidence
      .filter((item) => item.sourceType === this.tool)
      .filter((item) => {
        const timestamp = Date.parse(item.eventAt ?? item.publishedAt ?? item.retrievedAt);
        return timestamp >= from && timestamp <= to;
      })
      .map((item) => ({ ...item }));
  }
}

export class DisabledEvidenceAdapter implements EvidenceAdapter {
  readonly version = 'disabled';

  constructor(readonly tool: Exclude<ResearchTool, 'codali'>) {}

  async available(): Promise<boolean> {
    return false;
  }

  async retrieve(): Promise<RawEvidence[]> {
    throw new ToolUnavailableError(this.tool);
  }
}

export class DisabledCodaliAdapter implements CodaliAdapter {
  readonly tool = 'codali' as const;
  readonly version = 'disabled';

  async available(): Promise<boolean> {
    return false;
  }

  async synthesize(): Promise<SynthesisDraft> {
    throw new ToolUnavailableError('codali');
  }
}

export class DeterministicCodaliAdapter implements CodaliAdapter {
  readonly tool = 'codali' as const;
  readonly version = 'deterministic-1';

  async available(): Promise<boolean> {
    return true;
  }

  async synthesize({
    task,
    evidence,
    signal,
  }: Parameters<CodaliAdapter['synthesize']>[0]): Promise<SynthesisDraft> {
    signal?.throwIfAborted();
    const clean = evidence.filter(
      (item) => item.injectionSignals.length === 0 && item.accessState !== 'retracted',
    );
    const claims = clean.slice(0, 8).map((item, index) => ({
      claimId: `claim_${index + 1}`,
      statement: item.statement,
      classification: 'fact' as const,
      supportingEvidenceIds: [item.evidenceId],
      contradictingEvidenceIds: evidence
        .filter((candidate) => candidate.statement.toLowerCase().startsWith('contradiction:'))
        .map((candidate) => candidate.evidenceId),
      confidence: Math.max(0, Math.min(1, item.reliability)),
      materiality: Math.max(0.2, 1 - index * 0.1),
    }));
    const answer = clean.length
      ? `${task.question.trim()} The available evidence supports ${claims.length} material finding${claims.length === 1 ? '' : 's'} as of ${task.asOf.slice(0, 10)}.`
      : 'No usable evidence was available within the selected time window and source policy.';
    return {
      directAnswer: answer,
      executiveSummary: clean
        .slice(0, 3)
        .map((item) => item.statement)
        .join(' '),
      claims,
      contradictions: evidence
        .filter((item) => item.statement.toLowerCase().startsWith('contradiction:'))
        .map((item) => item.statement.replace(/^contradiction:\s*/i, '')),
      unknowns: clean.length ? [] : ['No retrievable evidence met the source policy.'],
      assumptions: [
        'Analysis is bounded by the selected sources, time window, and asOf timestamp.',
      ],
      impactPaths: [],
      inputTokens: Math.ceil(JSON.stringify(clean).length / 4),
      outputTokens: Math.ceil(answer.length / 4) + claims.length * 30,
      costUsd: 0,
      provider: 'deterministic-fixture',
      version: this.version,
    };
  }
}

export interface HttpAdapterOptions {
  endpoint: string;
  authorization?: string;
  timeoutMs?: number;
  allowLoopbackHttp?: boolean;
  fetch?: typeof globalThis.fetch;
}

export class HttpEvidenceAdapter implements EvidenceAdapter {
  readonly version = 'http-json-1';
  private readonly fetcher: typeof globalThis.fetch;

  constructor(
    readonly tool: Exclude<ResearchTool, 'codali'>,
    private readonly options: HttpAdapterOptions,
  ) {
    assertServiceEndpoint(options.endpoint, options.allowLoopbackHttp ?? false);
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async available(): Promise<boolean> {
    return true;
  }

  async retrieve(task: ResearchTask, signal?: AbortSignal): Promise<RawEvidence[]> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 20_000);
    const abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetcher(this.options.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          ...(this.options.authorization ? { authorization: this.options.authorization } : {}),
        },
        body: JSON.stringify({ task, tool: this.tool }),
        signal: controller.signal,
      });
      if (!response.ok)
        throw new Error(`${this.tool} retrieval failed with HTTP ${response.status}`);
      const body = (await response.json()) as { evidence?: RawEvidence[] };
      if (!Array.isArray(body.evidence))
        throw new TypeError(`${this.tool} returned an invalid evidence payload`);
      return body.evidence;
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener('abort', abort);
    }
  }
}

export class HttpCodaliAdapter implements CodaliAdapter {
  readonly tool = 'codali' as const;
  readonly version = 'codali-http-1';
  private readonly fetcher: typeof globalThis.fetch;

  constructor(private readonly options: HttpAdapterOptions) {
    assertServiceEndpoint(options.endpoint, options.allowLoopbackHttp ?? false);
    this.fetcher = options.fetch ?? globalThis.fetch;
  }

  async available(): Promise<boolean> {
    return true;
  }

  async synthesize(input: Parameters<CodaliAdapter['synthesize']>[0]): Promise<SynthesisDraft> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 45_000);
    const abort = () => controller.abort();
    input.signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await this.fetcher(this.options.endpoint, {
        method: 'POST',
        redirect: 'error',
        headers: {
          'content-type': 'application/json',
          ...(this.options.authorization ? { authorization: this.options.authorization } : {}),
        },
        body: JSON.stringify({
          task: input.task,
          skill: input.skill,
          evidence: input.evidence,
          allowedTools: [],
          outputSchema: 'tnl.research.result.v1',
          exposeReasoning: false,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error(`Codali synthesis failed with HTTP ${response.status}`);
      return (await response.json()) as SynthesisDraft;
    } finally {
      clearTimeout(timer);
      input.signal?.removeEventListener('abort', abort);
    }
  }
}

function assertServiceEndpoint(value: string, allowLoopbackHttp: boolean): void {
  const url = new URL(value);
  const loopback = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(allowLoopbackHttp && loopback && url.protocol === 'http:'))
    throw new TypeError('Research service endpoints require HTTPS; loopback HTTP must be explicit');
  if (url.username || url.password)
    throw new TypeError('Research service credentials cannot appear in URLs');
}
