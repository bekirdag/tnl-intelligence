import { RESEARCH_MCP_APP_URI, RESEARCH_SCHEMA_VERSION } from '@theneuralledger/research';
import { ADAPTER_WORKFLOWS } from './catalog.js';
import {
  MCP_PROTOCOL_VERSION,
  MINIMUM_GATEWAY_VERSION,
  type AdapterCapabilitySnapshot,
  type AdapterProfileSelection,
  type CapabilityDecision,
} from './contracts.js';

export function negotiateCapabilities(snapshot: AdapterCapabilitySnapshot): CapabilityDecision {
  const tools = new Set(snapshot.tools);
  const missingTools = ADAPTER_WORKFLOWS.map((workflow) => workflow.toolName).filter(
    (tool) => !tools.has(tool),
  );
  const reasons: string[] = [];
  if (snapshot.protocolVersion !== MCP_PROTOCOL_VERSION)
    reasons.push(`MCP protocol ${MCP_PROTOCOL_VERSION} is required`);
  if (!versionAtLeast(snapshot.gatewayVersion, MINIMUM_GATEWAY_VERSION))
    reasons.push(`Gateway ${MINIMUM_GATEWAY_VERSION} or newer is required`);
  if (snapshot.researchSchemaVersion !== RESEARCH_SCHEMA_VERSION)
    reasons.push(`Research schema ${RESEARCH_SCHEMA_VERSION} is required`);
  if (missingTools.length) reasons.push(`Missing research tools: ${missingTools.join(', ')}`);
  return {
    compatible: reasons.length === 0,
    missingTools,
    reasons,
    richResearchUi: snapshot.resources?.includes(RESEARCH_MCP_APP_URI) ?? false,
  };
}

export function selectAdapterProfile(input: {
  localConfigured: boolean;
  remoteConfigured: boolean;
  preferred?: 'local' | 'remote';
}): AdapterProfileSelection {
  if (!input.localConfigured && !input.remoteConfigured)
    throw new TypeError('Configure a local or remote TNL MCP profile');
  if (input.localConfigured && input.remoteConfigured && !input.preferred)
    throw new TypeError('Both TNL MCP profiles are configured; choose local or remote');
  const mode = input.preferred ?? (input.remoteConfigured ? 'remote' : 'local');
  if (mode === 'local' && !input.localConfigured)
    throw new TypeError('Local profile is not configured');
  if (mode === 'remote' && !input.remoteConfigured)
    throw new TypeError('Remote profile is not configured');
  return { mode, localConfigured: input.localConfigured, remoteConfigured: input.remoteConfigured };
}

function versionAtLeast(value: string, minimum: string): boolean {
  const left = numericVersion(value);
  const right = numericVersion(minimum);
  if (!left || !right) return false;
  for (let index = 0; index < 3; index += 1) {
    if ((left[index] ?? 0) > (right[index] ?? 0)) return true;
    if ((left[index] ?? 0) < (right[index] ?? 0)) return false;
  }
  return true;
}

function numericVersion(value: string): number[] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(value);
  return match ? match.slice(1).map(Number) : undefined;
}
