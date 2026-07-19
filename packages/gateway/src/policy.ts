import { TNL_TOOL_NAMES, type TnlToolName } from '@theneuralledger/mcp';
import type { AccessContext, DisableStore, Principal } from './contracts.js';
import { GatewayError } from './errors.js';

export const POLICY_VERSION = '2026-07-18.1';
export const BASE_SCOPE = 'tnl:read';
export const RESEARCH_SCOPE = 'tnl:research';

const RESEARCH_TOOLS = new Set<TnlToolName>([
  'tnl_explain_event',
  'tnl_deep_research',
  'tnl_research_what_changed',
  'tnl_research_compare_sources',
  'tnl_research_validate_event',
  'tnl_research_asset_exposure',
  'tnl_research_operational_risk',
  'tnl_research_weekly_consequential',
]);

export class InMemoryDisableStore implements DisableStore {
  globalReason?: string;
  readonly tenants = new Map<string, string>();
  readonly principals = new Map<string, string>();
  readonly clients = new Map<string, string>();
  readonly tools = new Map<TnlToolName, string>();

  async reason(principal: Principal, tool?: TnlToolName): Promise<string | undefined> {
    return (
      this.globalReason ??
      this.tenants.get(principal.tenantId) ??
      this.principals.get(principal.id) ??
      this.clients.get(principal.clientId) ??
      (tool ? this.tools.get(tool) : undefined)
    );
  }
}

export interface HttpDisableStoreOptions {
  endpoint: string;
  serviceToken: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class HttpDisableStore implements DisableStore {
  readonly #options: HttpDisableStoreOptions;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: HttpDisableStoreOptions) {
    if (new URL(options.endpoint).protocol !== 'https:') {
      throw new TypeError('Production disable service must use HTTPS');
    }
    this.#options = options;
    this.#fetch = options.fetch ?? globalThis.fetch;
  }

  async reason(principal: Principal, tool?: TnlToolName): Promise<string | undefined> {
    let response: Response;
    try {
      response = await this.#fetch(this.#options.endpoint, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${this.#options.serviceToken}`,
          'content-type': 'application/json',
          accept: 'application/json',
        },
        body: JSON.stringify({
          tenantId: principal.tenantId,
          principalId: principal.id,
          clientId: principal.clientId,
          tool,
        }),
        signal: AbortSignal.timeout(this.#options.timeoutMs ?? 3_000),
      });
    } catch (error) {
      throw new GatewayError('dependency_unavailable', 'Disable service is unavailable', 503, {
        cause: error,
      });
    }
    if (!response.ok) {
      throw new GatewayError('dependency_unavailable', 'Disable service is unavailable', 503);
    }
    const value = (await response.json()) as Record<string, unknown>;
    return value.disabled === true
      ? String(value.reason || 'administratively_disabled')
      : undefined;
  }
}

export async function authorize(
  access: AccessContext,
  disableStore: DisableStore,
  requestedTool?: string,
): Promise<{ allowedTools: ReadonlySet<TnlToolName>; tool?: TnlToolName }> {
  if (access.entitlement.status === 'suspended') {
    throw new GatewayError('account_suspended', 'Account is suspended', 403);
  }
  if (access.entitlement.status === 'expired') {
    throw new GatewayError('entitlement_expired', 'Entitlement has expired', 403);
  }
  if (!access.principal.scopes.has(BASE_SCOPE)) {
    throw new GatewayError('insufficient_scope', 'Read access is required', 403, {
      requiredScope: BASE_SCOPE,
    });
  }
  const tool = requestedTool === undefined ? undefined : parseTool(requestedTool);
  const disabled = await disableStore.reason(access.principal, tool);
  if (disabled) throw new GatewayError('access_disabled', 'Access is disabled', 403);

  const allowedTools = new Set<TnlToolName>();
  for (const candidate of TNL_TOOL_NAMES) {
    if (access.entitlement.allowedTools && !access.entitlement.allowedTools.has(candidate))
      continue;
    if (RESEARCH_TOOLS.has(candidate) && !access.principal.scopes.has(RESEARCH_SCOPE)) continue;
    allowedTools.add(candidate);
  }
  if (tool && !allowedTools.has(tool)) {
    throw new GatewayError('insufficient_scope', 'Additional scope is required', 403, {
      requiredScope: RESEARCH_TOOLS.has(tool) ? RESEARCH_SCOPE : BASE_SCOPE,
    });
  }
  return { allowedTools, ...(tool ? { tool } : {}) };
}

export function isResearchTool(tool: TnlToolName | undefined): boolean {
  return tool !== undefined && RESEARCH_TOOLS.has(tool);
}

function parseTool(value: string): TnlToolName {
  if ((TNL_TOOL_NAMES as readonly string[]).includes(value)) return value as TnlToolName;
  throw new GatewayError('invalid_request', 'Unknown TNL tool', 400);
}
