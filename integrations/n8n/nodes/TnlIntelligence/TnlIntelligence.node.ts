import type {
  IDataObject,
  IExecuteFunctions,
  INodeExecutionData,
  INodeType,
  INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionTypes, NodeOperationError } from 'n8n-workflow';
import {
  executeTnlOperation,
  type TnlOperationRequest,
} from '../shared/runtime';

export class TnlIntelligence implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'TNL Intelligence',
    name: 'tnlIntelligence',
    icon: {
      light: 'file:../../icons/tnl-bot.svg',
      dark: 'file:../../icons/tnl-bot-dark.svg',
    },
    group: ['transform'],
    version: 1,
    subtitle: '={{$parameter["operation"]}}',
    description: 'Search, retrieve, enrich, and research TNL intelligence',
    defaults: { name: 'TNL Intelligence' },
    inputs: [NodeConnectionTypes.Main],
    outputs: [NodeConnectionTypes.Main],
    usableAsTool: true,
    credentials: [{ name: 'tnlApi', required: true }],
    properties: [
      {
        displayName: 'Resource',
        name: 'resource',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Intelligence', value: 'intelligence' },
          { name: 'Research', value: 'research' },
        ],
        default: 'intelligence',
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Get Exposure', value: 'get_exposure', action: 'Get exposure' },
          { name: 'Get Intelligence', value: 'get_intelligence', action: 'Get intelligence' },
          { name: 'List Recent Changes', value: 'list_recent_changes', action: 'List recent changes' },
          { name: 'Search Intelligence', value: 'search_intelligence', action: 'Search intelligence' },
        ],
        default: 'search_intelligence',
        displayOptions: { show: { resource: ['intelligence'] } },
      },
      {
        displayName: 'Operation',
        name: 'operation',
        type: 'options',
        noDataExpression: true,
        options: [
          { name: 'Get Research Result', value: 'get_research_result', action: 'Get research result' },
          { name: 'Get Weekly Edition', value: 'get_weekly_edition', action: 'Get weekly edition' },
          { name: 'Run Research', value: 'run_research', action: 'Run research' },
        ],
        default: 'run_research',
        displayOptions: { show: { resource: ['research'] } },
      },
      {
        displayName: 'Query',
        name: 'query',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['search_intelligence'] } },
        required: true,
      },
      {
        displayName: 'Identifier',
        name: 'identifier',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['get_intelligence', 'get_exposure'] } },
        required: true,
      },
      {
        displayName: 'Exposure Kind',
        name: 'exposureKind',
        type: 'options',
        options: [
          { name: 'Asset', value: 'asset' },
          { name: 'Entity', value: 'entity' },
          { name: 'Impact Path', value: 'impact_path' },
        ],
        default: 'entity',
        displayOptions: { show: { operation: ['get_exposure'] } },
      },
      {
        displayName: 'Research Result ID',
        name: 'resultId',
        type: 'string',
        default: '',
        displayOptions: { show: { operation: ['get_research_result'] } },
        required: true,
      },
      {
        displayName: 'Research Workflow',
        name: 'workflowId',
        type: 'options',
        options: [
          { name: 'Asset Exposure', value: 'asset-exposure' },
          { name: 'Compare Sources', value: 'compare-sources' },
          { name: 'Operational Risk', value: 'operational-risk' },
          { name: 'Validate Event', value: 'validate-event' },
          { name: 'Weekly Consequential', value: 'weekly-consequential' },
          { name: 'What Changed', value: 'what-changed' },
        ],
        default: 'what-changed',
        displayOptions: { show: { operation: ['run_research'] } },
      },
      {
        displayName: 'Research Question',
        name: 'question',
        type: 'string',
        typeOptions: { rows: 3 },
        default: '',
        displayOptions: { show: { operation: ['run_research'] } },
        required: true,
      },
      {
        displayName: 'From (UTC)',
        name: 'from',
        type: 'dateTime',
        default: '',
        description: 'Inclusive published or research start time',
      },
      {
        displayName: 'To (UTC)',
        name: 'to',
        type: 'dateTime',
        default: '',
        description: 'Inclusive published or research end time',
      },
      {
        displayName: 'Page Size',
        name: 'pageSize',
        type: 'number',
        typeOptions: { minValue: 1, maxValue: 100 },
        default: 25,
        displayOptions: { hide: { operation: ['get_intelligence', 'run_research', 'get_research_result', 'get_weekly_edition'] } },
      },
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const credentials = await this.getCredentials('tnlApi');
    const output: INodeExecutionData[] = [];
    const input = this.getInputData();
    for (let index = 0; index < Math.max(input.length, 1); index += 1) {
      try {
        const operation = this.getNodeParameter('operation', index) as string;
        const request = operationInput(this, operation, index);
        const result = await executeTnlOperation(this, credentials, request);
        output.push({ json: result as unknown as IDataObject, pairedItem: index });
      } catch (error) {
        if (this.continueOnFail()) {
          output.push({ json: { error: safeError(error) }, pairedItem: index });
          continue;
        }
        throw new NodeOperationError(this.getNode(), error as Error, { itemIndex: index });
      }
    }
    return [output];
  }
}

function operationInput(
  context: IExecuteFunctions,
  operation: string,
  index: number,
): TnlOperationRequest {
  const from = optional(context.getNodeParameter('from', index, '') as string);
  const to = optional(context.getNodeParameter('to', index, '') as string);
  const pageSize = context.getNodeParameter('pageSize', index, 25) as number;
  const range = { ...(from ? { from } : {}), ...(to ? { to } : {}) };
  switch (operation) {
    case 'search_intelligence':
      return { operation, input: { query: context.getNodeParameter('query', index) as string, pageSize, ...range } } as const;
    case 'get_intelligence':
      return { operation, input: { id: context.getNodeParameter('identifier', index) as string } } as const;
    case 'list_recent_changes':
      return { operation, input: { since: from ?? new Date(Date.now() - 86_400_000).toISOString(), pageSize } } as const;
    case 'get_exposure':
      return {
        operation,
        input: {
          kind: context.getNodeParameter('exposureKind', index) as 'entity' | 'asset' | 'impact_path',
          value: context.getNodeParameter('identifier', index) as string,
          pageSize,
          ...range,
        },
      } as const;
    case 'run_research':
      return {
        operation,
        input: {
          workflowId: context.getNodeParameter('workflowId', index) as string,
          question: context.getNodeParameter('question', index) as string,
          ...range,
        },
      } as const;
    case 'get_research_result':
      return {
        operation,
        input: { resultId: context.getNodeParameter('resultId', index) as string },
      } as const;
    case 'get_weekly_edition':
      return { operation, input: { ...(to ? { weekEnding: to } : {}) } } as const;
    default:
      throw new NodeOperationError(context.getNode(), 'Unsupported TNL operation');
  }
}

function optional(value: string): string | undefined {
  return value.trim() || undefined;
}

function safeError(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 300) : 'TNL connector failed';
}
