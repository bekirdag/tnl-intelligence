import type { ConnectorOperationDefinition } from './contracts.js';

export const CONNECTOR_OPERATIONS = Object.freeze([
  operation(
    'search_intelligence',
    'Search intelligence',
    'Search cited TNL intelligence with bounded filters and cursor pagination.',
    'tnl:read',
  ),
  operation(
    'get_intelligence',
    'Get intelligence item',
    'Retrieve one stable TNL intelligence item and its revision metadata.',
    'tnl:read',
  ),
  operation(
    'list_recent_changes',
    'List recent changes',
    'List published, revised, or retracted intelligence since an explicit timestamp.',
    'tnl:read',
  ),
  operation(
    'get_exposure',
    'Get entity or asset exposure',
    'Retrieve structured stories and impact paths for an entity, asset, or impact path.',
    'tnl:read',
  ),
  operation(
    'run_research',
    'Run research skill',
    'Run one evidence-first TNL Bot research workflow with citations and an as-of boundary.',
    'tnl:research',
    true,
  ),
  operation(
    'get_research_result',
    'Get research result',
    'Retrieve a previously started research result by stable result ID.',
    'tnl:research',
  ),
  operation(
    'get_weekly_edition',
    'Get weekly consequential edition',
    'Retrieve the cited weekly consequential-development edition.',
    'tnl:research',
  ),
] satisfies readonly ConnectorOperationDefinition[]);

function operation(
  id: ConnectorOperationDefinition['id'],
  title: string,
  description: string,
  requiredScope: ConnectorOperationDefinition['requiredScope'],
  asynchronous = false,
): ConnectorOperationDefinition {
  return { id, title, description, requiredScope, asynchronous };
}
