import {
  TnlAuthenticationError,
  TnlError,
  TnlRateLimitError,
  TnlTimeoutError,
} from '@theneuralledger/sdk';

export type ConnectorErrorCode =
  | 'authentication_required'
  | 'permission_denied'
  | 'validation_error'
  | 'not_found'
  | 'rate_limited'
  | 'capability_unavailable'
  | 'upstream_unavailable'
  | 'timeout'
  | 'duplicate_event'
  | 'invalid_webhook'
  | 'internal_error';

export class ConnectorError extends Error {
  constructor(
    readonly code: ConnectorErrorCode,
    message: string,
    readonly retryable: boolean,
    readonly retryAfterSeconds?: number,
  ) {
    super(message);
    this.name = 'ConnectorError';
  }

  toJSON(): {
    code: ConnectorErrorCode;
    message: string;
    retryable: boolean;
    retryAfterSeconds?: number;
  } {
    return {
      code: this.code,
      message: this.message,
      retryable: this.retryable,
      ...(this.retryAfterSeconds === undefined
        ? {}
        : { retryAfterSeconds: this.retryAfterSeconds }),
    };
  }
}

export function normalizeConnectorError(error: unknown): ConnectorError {
  if (error instanceof ConnectorError) return error;
  if (error instanceof TnlAuthenticationError)
    return new ConnectorError(
      error.status === 403 ? 'permission_denied' : 'authentication_required',
      error.status === 403
        ? 'The TNL connection lacks permission.'
        : 'The TNL connection must be authorized.',
      false,
    );
  if (error instanceof TnlRateLimitError)
    return new ConnectorError(
      'rate_limited',
      'The TNL request limit is temporarily exhausted.',
      true,
      error.retryAfterSeconds ?? undefined,
    );
  if (error instanceof TnlTimeoutError)
    return new ConnectorError('timeout', 'The TNL request timed out.', true);
  if (error instanceof TnlError) {
    if (error.status === 404)
      return new ConnectorError('not_found', 'The TNL resource was not found.', false);
    return new ConnectorError('upstream_unavailable', 'The TNL service request failed.', true);
  }
  if (error instanceof TypeError)
    return new ConnectorError('validation_error', safe(error.message), false);
  return new ConnectorError(
    'internal_error',
    'The connector could not complete the request.',
    true,
  );
}

function safe(value: string): string {
  return value.replace(/(?:Bearer\s+)?(?:sk|tnl)_[A-Za-z0-9._-]+/gi, '[redacted]').slice(0, 300);
}
