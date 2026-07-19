import type { AdapterWorkflow } from './contracts.js';

export const ADAPTER_WORKFLOWS = Object.freeze([
  workflow(
    'what-changed',
    'what_changed',
    'tnl_research_what_changed',
    'Research what changed',
    'Compare a selected period with its baseline and cite material changes.',
  ),
  workflow(
    'compare-sources',
    'source_comparison',
    'tnl_research_compare_sources',
    'Compare event sources',
    'Compare agreement, omissions, contradictions, framing, and timing across sources.',
  ),
  workflow(
    'validate-event',
    'event_validation',
    'tnl_research_validate_event',
    'Validate an event',
    'Corroborate a selected event and return a bounded verification state.',
  ),
  workflow(
    'asset-exposure',
    'asset_entity_exposure',
    'tnl_research_asset_exposure',
    'Research asset and entity exposure',
    'Map documented and inferred exposure paths, horizons, and counterfactors.',
  ),
  workflow(
    'operational-risk',
    'geopolitical_operational_risk',
    'tnl_research_operational_risk',
    'Research geopolitical and operational risk',
    'Build bounded scenarios, leading indicators, assumptions, and impact paths.',
  ),
  workflow(
    'weekly-consequential',
    'weekly_consequential',
    'tnl_research_weekly_consequential',
    'Research weekly consequential developments',
    'Deduplicate and rank a selected week using cited materiality evidence.',
  ),
] satisfies readonly AdapterWorkflow[]);

export function getAdapterWorkflow(id: string): AdapterWorkflow {
  const value = ADAPTER_WORKFLOWS.find((item) => item.id === id);
  if (!value) throw new TypeError(`Unknown adapter workflow: ${id}`);
  return value;
}

function workflow(
  id: string,
  taskType: AdapterWorkflow['taskType'],
  toolName: string,
  title: string,
  description: string,
): AdapterWorkflow {
  return {
    id,
    taskType,
    toolName,
    command: `tnl-${id}`,
    title,
    description,
    requiredScope: 'tnl:research',
  };
}
