import type { TnlToolName } from '@theneuralledger/mcp';

export interface VerifiedToken {
  issuer: string;
  subject: string;
  audience: readonly string[];
  scopes: ReadonlySet<string>;
  clientId: string;
  tokenIdHash: string;
  expiresAt: number;
  tenantHint?: string;
}

export interface Principal {
  id: string;
  tenantId: string;
  subject: string;
  issuer: string;
  clientId: string;
  scopes: ReadonlySet<string>;
  tokenIdHash: string;
  authenticationMethod: 'oauth_access_token';
}

export interface Entitlement {
  status: 'active' | 'suspended' | 'expired';
  plan: string;
  version: string;
  allowedScopes: ReadonlySet<string>;
  allowedTools?: ReadonlySet<TnlToolName>;
  quota: QuotaLimits;
}

export interface AccessContext {
  principal: Principal;
  entitlement: Entitlement;
}

export interface RequestContext {
  requestId: string;
  startedAt: number;
  clientIpHash: string;
  userAgentHash: string;
}

export interface TokenVerifier {
  verify(token: string, now?: number): Promise<VerifiedToken>;
  health?(): Promise<boolean>;
}

export interface AccessResolver {
  resolve(token: VerifiedToken): Promise<AccessContext>;
  health?(): Promise<boolean>;
}

export interface CapabilityRequest {
  principal: Principal;
  tools: ReadonlySet<TnlToolName>;
  requestId: string;
  expiresAt: number;
}

export interface UpstreamCapability {
  accessToken: string;
  baseUrl: string;
  expiresAt: number;
}

export interface CapabilityProvider {
  issue(request: CapabilityRequest): Promise<UpstreamCapability>;
  health?(): Promise<boolean>;
}

export interface QuotaLimits {
  globalPerMinute: number;
  tenantPerMinute: number;
  principalPerMinute: number;
  clientPerMinute: number;
  researchPerMinute: number;
}

export interface QuotaRequest {
  principal: Principal;
  tool?: TnlToolName;
  limits: QuotaLimits;
  now: number;
}

export interface QuotaDecision {
  allowed: boolean;
  reason:
    | 'allowed'
    | 'global_limit'
    | 'tenant_limit'
    | 'principal_limit'
    | 'client_limit'
    | 'research_limit';
  retryAfterSeconds: number;
  remaining: number;
  resetAt: number;
}

export interface QuotaStore {
  consume(request: QuotaRequest): Promise<QuotaDecision>;
  health?(): Promise<boolean>;
}

export interface DisableStore {
  reason(principal: Principal, tool?: TnlToolName): Promise<string | undefined>;
  health?(): Promise<boolean>;
}

export type AuditEventType =
  | 'authentication_denied'
  | 'policy_denied'
  | 'quota_denied'
  | 'tool_call'
  | 'request_completed'
  | 'dependency_failure';

export interface AuditEvent {
  timestamp: string;
  type: AuditEventType;
  requestId: string;
  outcome: 'allowed' | 'denied' | 'error';
  reason: string;
  durationMs: number;
  principalIdHash?: string;
  tenantIdHash?: string;
  clientIdHash?: string;
  tool?: TnlToolName;
  policyVersion?: string;
}

export interface AuditSink {
  emit(event: AuditEvent): Promise<void>;
  health?(): Promise<boolean>;
}

export interface GatewayMetrics {
  increment(name: string, labels?: Readonly<Record<string, string>>): void;
  observe(name: string, value: number, labels?: Readonly<Record<string, string>>): void;
  render(): string;
}
