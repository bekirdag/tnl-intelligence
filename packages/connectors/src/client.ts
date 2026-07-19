import { buildResearchTask } from '@theneuralledger/adapters';
import type { TnlNewsPage, TnlNewsQuery, TnlStory } from '@theneuralledger/sdk';
import { TnlClient } from '@theneuralledger/sdk';
import type { ResearchResult, ResearchTask } from '@theneuralledger/research';
import type {
  ConnectorOperationInput,
  ConnectorOperationOutput,
  ExposureInput,
  NormalizedStory,
  PageOutput,
  SearchInput,
} from './contracts.js';
import { ConnectorError, normalizeConnectorError } from './errors.js';

export interface ConnectorResearchRunner {
  run(task: ResearchTask): Promise<ResearchResult>;
  getResult(resultId: string): Promise<ResearchResult | undefined>;
}

export interface ConnectorClientOptions {
  apiKey: string;
  baseUrl?: string;
  fetch?: typeof globalThis.fetch;
  research?: ConnectorResearchRunner;
  now?: () => Date;
}

export class ConnectorClient {
  readonly #client: TnlClient;
  readonly #research: ConnectorResearchRunner | undefined;
  readonly #now: () => Date;

  constructor(options: ConnectorClientOptions) {
    this.#client = new TnlClient({
      apiKey: options.apiKey,
      ...(options.baseUrl ? { baseUrl: options.baseUrl } : {}),
      ...(options.fetch ? { fetch: options.fetch } : {}),
      userAgent: '@theneuralledger/connectors/0.1.0',
    });
    this.#research = options.research;
    this.#now = options.now ?? (() => new Date());
  }

  async validateConnection(): Promise<{ connected: true; capabilities: string[] }> {
    try {
      await this.#client.getAccount();
      return { connected: true, capabilities: ['tnl:read'] };
    } catch (error) {
      throw normalizeConnectorError(error);
    }
  }

  async execute(request: ConnectorOperationInput): Promise<ConnectorOperationOutput> {
    try {
      switch (request.operation) {
        case 'search_intelligence':
          return { operation: request.operation, data: await this.search(request.input) };
        case 'get_intelligence': {
          const value = await this.#client.getNews(identifier(request.input.id), {
            include: request.input.includeBody ? ['sources', 'claims'] : ['sources'],
          });
          return {
            operation: request.operation,
            data: normalizeStory(value, this.#now(), request.input.includeBody ?? false),
          };
        }
        case 'list_recent_changes': {
          const since = timestamp(request.input.since, 'since');
          const page = await this.#client.listNews({
            ...query(request.input),
            updatedSince: since,
            sort: 'pipeline',
          });
          return { operation: request.operation, data: normalizePage(page, this.#now()) };
        }
        case 'get_exposure':
          return { operation: request.operation, data: await this.exposure(request.input) };
        case 'run_research': {
          if (!this.#research)
            throw new ConnectorError('capability_unavailable', 'Research is not configured', false);
          const built = buildResearchTask(
            {
              workflowId: request.input.workflowId,
              question: request.input.question,
              ...(request.input.from ? { from: request.input.from } : {}),
              ...(request.input.to ? { to: request.input.to } : {}),
              ...(request.input.asOf ? { asOf: request.input.asOf } : {}),
              ...(request.input.depth ? { depth: request.input.depth } : {}),
              ...(request.input.storyIds ? { storyIds: request.input.storyIds } : {}),
              ...(request.input.entities ? { entities: request.input.entities } : {}),
              ...(request.input.assets ? { assets: request.input.assets } : {}),
            },
            this.#now(),
          );
          return { operation: request.operation, data: await this.#research.run(built.task) };
        }
        case 'get_research_result': {
          if (!this.#research)
            throw new ConnectorError('capability_unavailable', 'Research is not configured', false);
          const resultId = identifier(request.input.resultId);
          const result = await this.#research.getResult(resultId);
          if (!result)
            throw new ConnectorError('not_found', 'The research result was not found.', false);
          return { operation: request.operation, data: result };
        }
        case 'get_weekly_edition': {
          if (!this.#research)
            throw new ConnectorError('capability_unavailable', 'Research is not configured', false);
          const end = request.input.weekEnding
            ? timestamp(request.input.weekEnding, 'weekEnding')
            : this.#now().toISOString();
          const from = new Date(Date.parse(end) - 7 * 86_400_000).toISOString();
          const result = await this.#research.run(
            buildResearchTask(
              {
                workflowId: 'weekly-consequential',
                question: 'What were the most consequential developments in this period?',
                from,
                to: end,
                asOf: end,
                ...(request.input.category ? { categories: [request.input.category] } : {}),
                ...(request.input.geography ? { geographies: [request.input.geography] } : {}),
              },
              this.#now(),
            ).task,
          );
          return { operation: request.operation, data: result };
        }
      }
    } catch (error) {
      if (error instanceof ConnectorError) throw error;
      throw normalizeConnectorError(error);
    }
  }

  private async search(input: SearchInput): Promise<PageOutput> {
    if (!input.query?.trim())
      throw new ConnectorError('validation_error', 'query is required', false);
    const page = await this.#client.searchNews({ query: input.query.trim(), ...query(input) });
    return normalizePage(page, this.#now(), input.includeBody ?? false);
  }

  private async exposure(input: ExposureInput): Promise<PageOutput> {
    const value = identifier(input.value);
    const parameters = query(input);
    const page =
      input.kind === 'entity'
        ? await this.#client.getEntityStories(value, parameters)
        : input.kind === 'asset'
          ? await this.#client.getAssetStories(value, parameters)
          : await this.#client.getImpactPathStories(value, parameters);
    return normalizePage(page, this.#now());
  }
}

export function normalizeStory(
  story: TnlStory,
  retrievedAt: Date,
  includeBody = false,
): NormalizedStory {
  const revision = number(story.revision) ?? number(story.version) ?? 1;
  const canonicalUrl =
    string(story.canonicalUrl) ??
    `https://theneuralledger.com/news/${encodeURIComponent(story.slug ?? story.id)}`;
  const citations = (story.sources ?? [])
    .filter((source) => typeof source.url === 'string')
    .map((source) => ({
      label: source.name ?? source.label ?? 'Source',
      url: source.url as string,
    }));
  return {
    id: story.id,
    revision,
    title: string(story.title),
    summary: string(story.excerpt),
    category: string(story.category),
    canonicalUrl,
    eventAt: date(story.date),
    publishedAt: date(story.publishedAt),
    updatedAt: date(story.updatedAt),
    retrievedAt: retrievedAt.toISOString(),
    status: string(story.storyStatus),
    impact: string(story.impact),
    confidence: number(story.truthPosterior),
    entities: unique([...(story.passiveEntities ?? []), ...array(story.entities)]),
    assets: unique(story.impactedAssets ?? []),
    impactPaths: unique(story.impactPaths ?? []),
    citations,
    ...(includeBody && typeof story.body === 'string' ? { body: story.body } : {}),
  };
}

export function normalizePage(page: TnlNewsPage, now: Date, includeBody = false): PageOutput {
  return {
    items: page.data.map((item) => normalizeStory(item, now, includeBody)),
    nextCursor: page.page.next_cursor,
    asOf: date(page.lastSyncAt) ?? now.toISOString(),
    count: page.data.length,
  };
}

function query(input: {
  from?: string;
  to?: string;
  category?: string;
  geography?: string;
  entity?: string;
  asset?: string;
  impactPath?: string;
  pageSize?: number;
  cursor?: string;
  includeBody?: boolean;
}): TnlNewsQuery {
  const pageSize = input.pageSize ?? 50;
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100)
    throw new ConnectorError('validation_error', 'pageSize must be from 1 to 100', false);
  return {
    pageSize,
    ...(input.cursor ? { cursor: identifier(input.cursor) } : {}),
    ...(input.from ? { publishedSince: timestamp(input.from, 'from') } : {}),
    ...(input.to ? { publishedUntil: timestamp(input.to, 'to') } : {}),
    ...(input.category ? { category: input.category } : {}),
    ...(input.geography ? { country: input.geography } : {}),
    ...(input.entity ? { entity: input.entity } : {}),
    ...(input.impactPath ? { impactPath: input.impactPath } : {}),
    ...(input.includeBody ? { fields: ['id', 'title', 'body', 'publishedAt', 'updatedAt'] } : {}),
  };
}

function timestamp(value: string, field: string): string {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed))
    throw new ConnectorError('validation_error', `${field} must be an ISO timestamp`, false);
  return new Date(parsed).toISOString();
}

function identifier(value: string): string {
  const result = value?.trim();
  if (!result || result.length > 256)
    throw new ConnectorError('validation_error', 'identifier is invalid', false);
  return result;
}

function string(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value : null;
}

function number(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function date(value: unknown): string | null {
  return typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(Date.parse(value)).toISOString()
    : null;
}

function array(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}
