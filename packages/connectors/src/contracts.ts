import type { ResearchDepth, ResearchResult } from '@theneuralledger/research';
import type { WebhookEventEnvelope, WebhookEventType } from '@theneuralledger/events';

export const CONNECTOR_SCHEMA_VERSION = '1.0' as const;
export const CONNECTOR_VERSION = '0.1.0' as const;

export const CONNECTOR_OPERATION_IDS = [
  'search_intelligence',
  'get_intelligence',
  'list_recent_changes',
  'get_exposure',
  'run_research',
  'get_research_result',
  'get_weekly_edition',
] as const;
export type ConnectorOperationId = (typeof CONNECTOR_OPERATION_IDS)[number];

export interface ConnectorOperationDefinition {
  id: ConnectorOperationId;
  title: string;
  description: string;
  requiredScope: 'tnl:read' | 'tnl:research';
  asynchronous: boolean;
}

export interface SearchInput {
  query: string;
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
}

export interface RecentChangesInput extends Omit<SearchInput, 'query'> {
  since: string;
}

export interface GetInput {
  id: string;
  includeBody?: boolean;
}

export interface ExposureInput {
  kind: 'entity' | 'asset' | 'impact_path';
  value: string;
  from?: string;
  to?: string;
  pageSize?: number;
  cursor?: string;
}

export interface ResearchInput {
  workflowId: string;
  question: string;
  from?: string;
  to?: string;
  asOf?: string;
  depth?: ResearchDepth;
  storyIds?: string[];
  entities?: string[];
  assets?: string[];
}

export interface ResearchResultInput {
  resultId: string;
}

export interface WeeklyInput {
  weekEnding?: string;
  category?: string;
  geography?: string;
}

export type ConnectorOperationInput =
  | { operation: 'search_intelligence'; input: SearchInput }
  | { operation: 'get_intelligence'; input: GetInput }
  | { operation: 'list_recent_changes'; input: RecentChangesInput }
  | { operation: 'get_exposure'; input: ExposureInput }
  | { operation: 'run_research'; input: ResearchInput }
  | { operation: 'get_research_result'; input: ResearchResultInput }
  | { operation: 'get_weekly_edition'; input: WeeklyInput };

export interface NormalizedStory {
  id: string;
  revision: number;
  title: string | null;
  summary: string | null;
  category: string | null;
  canonicalUrl: string;
  eventAt: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
  retrievedAt: string;
  status: string | null;
  impact: string | null;
  confidence: number | null;
  entities: string[];
  assets: string[];
  impactPaths: string[];
  citations: Array<{ label: string; url: string }>;
  body?: string;
}

export interface PageOutput {
  items: NormalizedStory[];
  nextCursor: string | null;
  asOf: string;
  count: number;
}

export type ConnectorOperationOutput =
  | { operation: 'search_intelligence' | 'list_recent_changes' | 'get_exposure'; data: PageOutput }
  | { operation: 'get_intelligence'; data: NormalizedStory }
  | {
      operation: 'run_research' | 'get_research_result' | 'get_weekly_edition';
      data: ResearchResult;
    };

export interface TriggerFilter {
  categories?: string[];
  geographies?: string[];
  entities?: string[];
  assets?: string[];
  minimumConfidence?: number;
  languages?: string[];
}

export interface TriggerSubscriptionInput {
  endpoint: string;
  eventTypes: WebhookEventType[];
  filters?: TriggerFilter;
  secret?: string;
}

export interface TriggerSubscription {
  id: string;
  secret: string;
  keyId: string;
  state: string;
}

export interface ConnectorTriggerOutput {
  id: string;
  deliveryId: string;
  type: WebhookEventType;
  occurredAt: string;
  publishedAt: string;
  resourceId: string;
  revision: number;
  canonicalUrl: string;
  summary: string;
  categories: string[];
  geographies: string[];
  entities: string[];
  assets: string[];
  impactPaths: string[];
  confidence: number | null;
  envelope: WebhookEventEnvelope;
}
