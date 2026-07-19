import { randomUUID } from 'node:crypto';
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import {
  DEFAULT_RESEARCH_BUDGET,
  RESEARCH_MCP_APP_HTML,
  RESEARCH_MCP_APP_URI,
  type ResearchResult,
  type ResearchTask,
  type ResearchTaskType,
} from '@theneuralledger/research';
import * as z from 'zod/v4';

export const TNL_RESEARCH_TOOL_NAMES = [
  'tnl_research_what_changed',
  'tnl_research_compare_sources',
  'tnl_research_validate_event',
  'tnl_research_asset_exposure',
  'tnl_research_operational_risk',
  'tnl_research_weekly_consequential',
] as const;

export type TnlResearchToolName = (typeof TNL_RESEARCH_TOOL_NAMES)[number];

export interface TnlResearchRunner {
  run(task: ResearchTask): Promise<ResearchResult>;
  getResult?(resultId: string): Promise<ResearchResult | undefined>;
}

interface RegistrationOptions {
  allowedTools?: ReadonlySet<string>;
}

const readOnlyAnnotations = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: false,
  openWorldHint: true,
} as const;

const commonInput = {
  question: z.string().min(3).max(8_000),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  asOf: z.string().datetime({ offset: true }).optional(),
  depth: z.enum(['brief', 'standard', 'deep']).default('standard'),
  storyIds: z.array(z.string().min(1)).max(100).optional(),
  entities: z.array(z.string().min(1)).max(100).optional(),
  geographies: z.array(z.string().min(1)).max(100).optional(),
  categories: z.array(z.string().min(1)).max(100).optional(),
  assets: z.array(z.string().min(1)).max(100).optional(),
};

const definitions: ReadonlyArray<{
  name: TnlResearchToolName;
  taskType: ResearchTaskType;
  title: string;
  description: string;
}> = [
  {
    name: 'tnl_research_what_changed',
    taskType: 'what_changed',
    title: 'Research what changed',
    description:
      'Compare a recent TNL intelligence window with its baseline and cite material changes.',
  },
  {
    name: 'tnl_research_compare_sources',
    taskType: 'source_comparison',
    title: 'Compare event sources',
    description:
      'Compare agreement, omissions, contradictions, framing, and timing across cited sources.',
  },
  {
    name: 'tnl_research_validate_event',
    taskType: 'event_validation',
    title: 'Validate an event',
    description:
      'Corroborate a TNL event and return a bounded verification state with primary evidence.',
  },
  {
    name: 'tnl_research_asset_exposure',
    taskType: 'asset_entity_exposure',
    title: 'Research asset and entity exposure',
    description:
      'Map documented and inferred exposure paths with horizons, evidence, and counterfactors.',
  },
  {
    name: 'tnl_research_operational_risk',
    taskType: 'geopolitical_operational_risk',
    title: 'Research geopolitical and operational risk',
    description:
      'Build bounded scenarios, leading indicators, assumptions, and causal impact paths.',
  },
  {
    name: 'tnl_research_weekly_consequential',
    taskType: 'weekly_consequential',
    title: 'Research weekly consequential developments',
    description: 'Deduplicate and rank the selected week using a versioned materiality rubric.',
  },
];

export function registerResearchMcp(
  server: McpServer,
  runner: TnlResearchRunner,
  options: RegistrationOptions = {},
): void {
  for (const definition of definitions) {
    if (options.allowedTools && !options.allowedTools.has(definition.name)) continue;
    server.registerTool(
      definition.name,
      {
        title: definition.title,
        description: definition.description,
        inputSchema: commonInput,
        outputSchema: { data: z.unknown() },
        annotations: readOnlyAnnotations,
        _meta: {
          'openai/outputTemplate': RESEARCH_MCP_APP_URI,
          'ui/resourceUri': RESEARCH_MCP_APP_URI,
        },
      },
      async (args) => {
        const task = taskFromArgs(definition.taskType, args);
        const result = await runner.run(task);
        return {
          content: [{ type: 'text' as const, text: result.directAnswer }],
          structuredContent: { data: result },
        };
      },
    );
  }

  server.registerResource(
    'tnl-research-workspace',
    RESEARCH_MCP_APP_URI,
    {
      title: 'TNL research workspace',
      description: 'Inspect TNL research claims, evidence, citations, and run details.',
      mimeType: 'text/html;profile=mcp-app',
    },
    async (uri) => ({
      contents: [
        {
          uri: uri.toString(),
          mimeType: 'text/html;profile=mcp-app',
          text: RESEARCH_MCP_APP_HTML,
          _meta: { 'openai/widgetDescription': 'TNL evidence-first research workspace' },
        },
      ],
    }),
  );

  if (runner.getResult) {
    server.registerResource(
      'tnl-research-result',
      new ResourceTemplate('tnl://research/{resultId}', { list: undefined }),
      {
        title: 'Saved TNL research result',
        description: 'A tenant-authorized saved research result.',
        mimeType: 'application/json',
      },
      async (uri, variables) => {
        const value = variables.resultId;
        const resultId = Array.isArray(value) ? value[0] : value;
        if (!resultId) throw new TypeError('Research result id is required');
        const valueResult = await runner.getResult?.(resultId);
        if (!valueResult) throw new TypeError('Research result was not found');
        return {
          contents: [
            {
              uri: uri.toString(),
              mimeType: 'application/json',
              text: JSON.stringify(valueResult),
            },
          ],
        };
      },
    );
  }
}

function taskFromArgs(
  taskType: ResearchTaskType,
  args: {
    question: string;
    from?: string | undefined;
    to?: string | undefined;
    asOf?: string | undefined;
    depth?: 'brief' | 'standard' | 'deep' | undefined;
    storyIds?: string[] | undefined;
    entities?: string[] | undefined;
    geographies?: string[] | undefined;
    categories?: string[] | undefined;
    assets?: string[] | undefined;
  },
): ResearchTask {
  const asOf = args.asOf ?? args.to ?? new Date().toISOString();
  const to = args.to ?? asOf;
  const from = args.from ?? new Date(Date.parse(to) - 7 * 86_400_000).toISOString();
  return {
    schemaVersion: '1.0',
    taskId: `task_${randomUUID()}`,
    taskType,
    question: args.question,
    asOf,
    timeWindow: { from, to },
    ...(args.storyIds ? { selectedStoryIds: args.storyIds } : {}),
    ...(args.entities ? { entities: args.entities } : {}),
    ...(args.geographies ? { geographies: args.geographies } : {}),
    ...(args.categories ? { categories: args.categories } : {}),
    ...(args.assets ? { assets: args.assets } : {}),
    depth: args.depth ?? 'standard',
    sourcePolicy: {
      version: 'research-sources-1',
      requirePrimary: taskType === 'event_validation',
      minimumIndependentSources: taskType === 'weekly_consequential' ? 3 : 2,
      freshnessMs: 7 * 86_400_000,
    },
    budget: { ...DEFAULT_RESEARCH_BUDGET },
    outputFormat: 'json',
    locale: 'en',
  };
}
