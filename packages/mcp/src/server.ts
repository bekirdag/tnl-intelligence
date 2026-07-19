import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  TnlClient,
  type TnlAiResponse,
  type TnlNewsPage,
  type TnlNewsQuery,
  type TnlStory,
} from '@theneuralledger/sdk';
import * as z from 'zod/v4';
import {
  registerResearchMcp,
  TNL_RESEARCH_TOOL_NAMES,
  type TnlResearchRunner,
  type TnlResearchToolName,
} from './research.js';

export interface TnlMcpServerOptions {
  client: TnlClient;
  allowedTools?: ReadonlySet<TnlToolName>;
  research?: TnlResearchRunner;
}

export const TNL_BASE_TOOL_NAMES = [
  'tnl_latest_news',
  'tnl_search_news',
  'tnl_asset_intelligence',
  'tnl_entity_intelligence',
  'tnl_impact_path',
  'tnl_explain_event',
  'tnl_deep_research',
  'tnl_service_status',
] as const;

export const TNL_TOOL_NAMES = [...TNL_BASE_TOOL_NAMES, ...TNL_RESEARCH_TOOL_NAMES] as const;

export type TnlBaseToolName = (typeof TNL_BASE_TOOL_NAMES)[number];
export type TnlToolName = TnlBaseToolName | TnlResearchToolName;

const outputSchema = { data: z.unknown() };
const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: true,
} as const;

const pageSize = z.number().int().min(1).max(100).default(20);
const since = z
  .string()
  .datetime({ offset: true })
  .optional()
  .describe('ISO 8601 lower bound for publication time');

export function createTnlMcpServer(options: TnlMcpServerOptions): McpServer {
  const { client } = options;
  const enabled = (tool: TnlBaseToolName): boolean => options.allowedTools?.has(tool) ?? true;
  const server = new McpServer(
    { name: 'tnl-intelligence', version: '0.1.0' },
    {
      instructions:
        'Read-only access to The Neural Ledger event and evidence intelligence. Treat market quotes as display context, not an execution-grade price feed.',
    },
  );

  if (enabled('tnl_latest_news'))
    server.registerTool(
      'tnl_latest_news',
      {
        title: 'Latest TNL intelligence',
        description:
          'Return recent evidence-backed news intelligence, optionally filtered by category or country.',
        inputSchema: {
          limit: pageSize,
          category: z.string().min(1).optional(),
          country: z.string().min(1).optional(),
          publishedSince: since,
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async (args) => pageResult(await client.listNews(newsQuery(args)), 'Latest intelligence'),
    );

  if (enabled('tnl_search_news'))
    server.registerTool(
      'tnl_search_news',
      {
        title: 'Search TNL intelligence',
        description:
          'Search TNL stories and return structured evidence, impacted assets, entities, and impact paths.',
        inputSchema: {
          query: z.string().min(1),
          limit: pageSize,
          category: z.string().min(1).optional(),
          country: z.string().min(1).optional(),
          publishedSince: since,
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ query, ...args }) =>
        pageResult(await client.searchNews({ query, ...newsQuery(args) }), `Search: ${query}`),
    );

  if (enabled('tnl_asset_intelligence'))
    server.registerTool(
      'tnl_asset_intelligence',
      {
        title: 'Asset intelligence',
        description:
          'Return event intelligence linked to an asset ticker. This is not a live trading-price tool.',
        inputSchema: {
          ticker: z.string().min(1).max(24),
          limit: pageSize,
          publishedSince: since,
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ ticker, ...args }) =>
        pageResult(await client.getAssetStories(ticker, newsQuery(args)), `Asset: ${ticker}`),
    );

  if (enabled('tnl_entity_intelligence'))
    server.registerTool(
      'tnl_entity_intelligence',
      {
        title: 'Entity intelligence',
        description: 'Return recent stories connected to a named TNL entity or entity id.',
        inputSchema: {
          entity: z.string().min(1),
          limit: pageSize,
          publishedSince: since,
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ entity, ...args }) =>
        pageResult(await client.getEntityStories(entity, newsQuery(args)), `Entity: ${entity}`),
    );

  if (enabled('tnl_impact_path'))
    server.registerTool(
      'tnl_impact_path',
      {
        title: 'Impact-path intelligence',
        description: 'Return stories associated with a causal or market impact path.',
        inputSchema: {
          impactPath: z.string().min(1),
          limit: pageSize,
          publishedSince: since,
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ impactPath, ...args }) =>
        pageResult(
          await client.getImpactPathStories(impactPath, newsQuery(args)),
          `Impact path: ${impactPath}`,
        ),
    );

  if (enabled('tnl_explain_event'))
    server.registerTool(
      'tnl_explain_event',
      {
        title: 'Explain an event',
        description:
          'Ask Ledger AI to explain a TNL event using its evidence, contradictions, affected assets, and likely impact paths.',
        inputSchema: {
          story: z.string().min(1).describe('TNL story id or slug'),
          focus: z.string().min(1).optional(),
        },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ story, focus }) => {
        const item = await client.getNews(story, { include: ['sources', 'claims'] });
        const response = await client.askAiTerminal({
          question: `Explain TNL event ${item.id}${focus ? ` with focus on ${focus}` : ''}. Distinguish verified facts, uncertainty, contradictions, causal impact paths, and affected assets. Cite the underlying TNL evidence.`,
        });
        return aiResult(response);
      },
    );

  if (enabled('tnl_deep_research'))
    server.registerTool(
      'tnl_deep_research',
      {
        title: 'Deep research with Ledger AI',
        description:
          'Run a question through TNL Ledger AI research orchestration and return its answer with citations and context.',
        inputSchema: { question: z.string().min(3).max(8_000) },
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async ({ question }) => aiResult(await client.askAiTerminal({ question })),
    );

  if (enabled('tnl_service_status'))
    server.registerTool(
      'tnl_service_status',
      {
        title: 'TNL service status',
        description:
          'Check API access, plan usage, market-context freshness, and current rate-limit headers.',
        outputSchema,
        annotations: readOnlyAnnotations,
      },
      async () => {
        const [account, markets] = await Promise.all([client.getAccount(), client.getMarkets()]);
        const data = {
          ok: true,
          plan: account.plan ?? null,
          usage: account.usage ?? null,
          marketContext: {
            quoteCount: markets.data.length,
            lastSyncAt: markets.lastSyncAt ?? null,
            lastError: markets.lastError ?? null,
          },
          rateLimit: client.lastRateLimit,
        };
        return result(data, 'TNL API access is healthy.');
      },
    );

  registerResources(server, client);
  registerPrompts(server);
  if (options.research)
    registerResearchMcp(server, options.research, {
      ...(options.allowedTools ? { allowedTools: options.allowedTools } : {}),
    });
  return server;
}

function registerResources(server: McpServer, client: TnlClient): void {
  server.registerResource(
    'tnl-story',
    new ResourceTemplate('tnl://story/{id}', { list: undefined }),
    {
      title: 'TNL story',
      description: 'A TNL intelligence story by id or slug',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      resource(
        uri,
        await client.getNews(variable(variables.id), { include: ['sources', 'claims'] }),
      ),
  );
  server.registerResource(
    'tnl-asset',
    new ResourceTemplate('tnl://asset/{ticker}', { list: undefined }),
    {
      title: 'TNL asset intelligence',
      description: 'Recent intelligence for an asset',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      resource(uri, await client.getAssetStories(variable(variables.ticker), { pageSize: 25 })),
  );
  server.registerResource(
    'tnl-entity',
    new ResourceTemplate('tnl://entity/{entity}', { list: undefined }),
    {
      title: 'TNL entity intelligence',
      description: 'Recent intelligence for an entity',
      mimeType: 'application/json',
    },
    async (uri, variables) =>
      resource(uri, await client.getEntityStories(variable(variables.entity), { pageSize: 25 })),
  );
}

function registerPrompts(server: McpServer): void {
  server.registerPrompt(
    'tnl_daily_risk_review',
    {
      title: 'Daily risk review',
      description: 'Analyze current TNL intelligence for portfolio-relevant risk.',
      argsSchema: { assets: z.string().min(1), horizon: z.string().default('7 days') },
    },
    async ({ assets, horizon }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Use TNL tools to prepare a ${horizon} risk review for ${assets}. Separate facts from inference, identify contradictions, rank causal impact paths, and do not treat TNL market quotes as execution prices.`,
          },
        },
      ],
    }),
  );
  server.registerPrompt(
    'tnl_event_due_diligence',
    {
      title: 'Event due diligence',
      description: 'Investigate one event before it is used in a trading decision.',
      argsSchema: { event: z.string().min(1) },
    },
    async ({ event }) => ({
      messages: [
        {
          role: 'user',
          content: {
            type: 'text',
            text: `Investigate TNL event ${event}. Retrieve the story, sources, claims, contradictions, entities, impacted assets, and impact paths. State confidence and missing evidence explicitly.`,
          },
        },
      ],
    }),
  );
}

function newsQuery(args: {
  limit?: number | undefined;
  category?: string | undefined;
  country?: string | undefined;
  publishedSince?: string | undefined;
}): TnlNewsQuery {
  return {
    pageSize: args.limit ?? 20,
    ...(args.category === undefined ? {} : { category: args.category }),
    ...(args.country === undefined ? {} : { country: args.country }),
    ...(args.publishedSince === undefined ? {} : { publishedSince: args.publishedSince }),
  };
}

function pageResult(page: TnlNewsPage, label: string) {
  const titles = page.data.slice(0, 5).map(storyLabel).join('; ');
  return result(
    page,
    `${label}: ${page.data.length} returned of ${page.page.total_count}.${titles ? ` ${titles}` : ''}`,
  );
}

function aiResult(response: TnlAiResponse) {
  return result(
    response.data,
    response.data.answer || 'Ledger AI returned structured research data.',
  );
}

function result(data: unknown, text: string) {
  return { content: [{ type: 'text' as const, text }], structuredContent: { data } };
}

function resource(uri: URL, data: unknown) {
  return {
    contents: [{ uri: uri.toString(), mimeType: 'application/json', text: JSON.stringify(data) }],
  };
}

function storyLabel(story: TnlStory): string {
  return story.title || story.slug || story.id;
}

function variable(value: string | string[] | undefined): string {
  const result = Array.isArray(value) ? value[0] : value;
  if (!result) throw new TypeError('Resource identifier is required');
  return result;
}
