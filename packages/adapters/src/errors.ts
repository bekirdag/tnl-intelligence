export type AdapterErrorCode =
  | 'authentication_required'
  | 'permission_denied'
  | 'rate_limited'
  | 'capability_mismatch'
  | 'network_unavailable'
  | 'partial_result'
  | 'internal_error';

export interface AdapterFailure {
  code: AdapterErrorCode;
  message: string;
  recovery: string;
  retryable: boolean;
}

export function normalizeAdapterError(error: unknown): AdapterFailure {
  const status = statusOf(error);
  if (status === 401)
    return failure(
      'authentication_required',
      'TNL authorization is required.',
      'Sign in again.',
      false,
    );
  if (status === 403)
    return failure(
      'permission_denied',
      'This TNL capability is not enabled for the account.',
      'Request the tnl:research scope or use an entitled account.',
      false,
    );
  if (status === 429)
    return failure(
      'rate_limited',
      'The TNL research quota is temporarily exhausted.',
      'Retry after the displayed reset time.',
      true,
    );
  if (status === 404 || codeOf(error) === 'capability_mismatch')
    return failure(
      'capability_mismatch',
      'The requested TNL capability is unavailable.',
      'Refresh the MCP connection and verify the server version.',
      false,
    );
  if (
    error instanceof TypeError ||
    codeOf(error) === 'ECONNREFUSED' ||
    codeOf(error) === 'ETIMEDOUT'
  )
    return failure(
      'network_unavailable',
      'The TNL service could not be reached.',
      'Check the connection and retry.',
      true,
    );
  return failure(
    'internal_error',
    'TNL research could not complete the request.',
    'Retry with the request ID or contact TNL support.',
    true,
  );
}

export function partialResultFailure(): AdapterFailure {
  return failure(
    'partial_result',
    'Research completed with unresolved evidence gaps.',
    'Review warnings, unknowns, and citations before relying on the result.',
    true,
  );
}

function failure(
  code: AdapterErrorCode,
  message: string,
  recovery: string,
  retryable: boolean,
): AdapterFailure {
  return { code, message, recovery, retryable };
}

function statusOf(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const value = error as { status?: unknown; response?: { status?: unknown } };
  return typeof value.status === 'number'
    ? value.status
    : typeof value.response?.status === 'number'
      ? value.response.status
      : undefined;
}

function codeOf(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as { code?: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}
