export type GatewayErrorCode =
  | 'invalid_request'
  | 'invalid_token'
  | 'insufficient_scope'
  | 'identity_mapping_failed'
  | 'account_suspended'
  | 'entitlement_expired'
  | 'quota_exhausted'
  | 'access_disabled'
  | 'dependency_unavailable';

export class GatewayError extends Error {
  readonly code: GatewayErrorCode;
  readonly status: number;
  readonly requiredScope?: string;
  readonly retryAfterSeconds?: number;

  constructor(
    code: GatewayErrorCode,
    message: string,
    status: number,
    options: { requiredScope?: string; retryAfterSeconds?: number; cause?: unknown } = {},
  ) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = 'GatewayError';
    this.code = code;
    this.status = status;
    if (options.requiredScope !== undefined) this.requiredScope = options.requiredScope;
    if (options.retryAfterSeconds !== undefined) this.retryAfterSeconds = options.retryAfterSeconds;
  }
}
