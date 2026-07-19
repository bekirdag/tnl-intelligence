import type { ResearchDepth, ResearchTaskType } from '@theneuralledger/research';

export const ADAPTER_SCHEMA_VERSION = '1.0' as const;
export const ADAPTER_VERSION = '0.1.0' as const;
export const MINIMUM_GATEWAY_VERSION = '0.1.0' as const;
export const MCP_PROTOCOL_VERSION = '2025-11-25' as const;

export type AdapterHost = 'cursor' | 'openai';
export type AdapterConnectionMode = 'local' | 'remote';

export interface AdapterWorkflow {
  id: string;
  taskType: ResearchTaskType;
  toolName: string;
  command: string;
  title: string;
  description: string;
  requiredScope: 'tnl:research';
}

export interface ResearchTaskRequest {
  workflowId: string;
  question: string;
  from?: string;
  to?: string;
  asOf?: string;
  depth?: ResearchDepth;
  storyIds?: string[];
  entities?: string[];
  geographies?: string[];
  categories?: string[];
  assets?: string[];
  locale?: string;
  requestId?: string;
}

export interface AdapterCapabilitySnapshot {
  protocolVersion: string;
  gatewayVersion: string;
  researchSchemaVersion: string;
  tools: readonly string[];
  resources?: readonly string[];
}

export interface CapabilityDecision {
  compatible: boolean;
  missingTools: string[];
  reasons: string[];
  richResearchUi: boolean;
}

export interface AdapterProfileSelection {
  mode: AdapterConnectionMode;
  localConfigured: boolean;
  remoteConfigured: boolean;
}
