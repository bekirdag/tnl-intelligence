export interface TnlErrorOptions {
  status?: number;
  code?: string;
  details?: unknown;
  requestId?: string | null;
  retryAfterSeconds?: number | null;
  cause?: unknown;
}

export class TnlError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly details?: unknown;
  readonly requestId?: string | null;
  readonly retryAfterSeconds?: number | null;

  constructor(message: string, options: TnlErrorOptions = {}) {
    super(message, { cause: options.cause });
    this.name = 'TnlError';
    if (options.status !== undefined) this.status = options.status;
    if (options.code !== undefined) this.code = options.code;
    if (options.details !== undefined) this.details = options.details;
    if (options.requestId !== undefined) this.requestId = options.requestId;
    if (options.retryAfterSeconds !== undefined) {
      this.retryAfterSeconds = options.retryAfterSeconds;
    }
  }
}

export class TnlAuthenticationError extends TnlError {
  constructor(message: string, options: TnlErrorOptions = {}) {
    super(message, options);
    this.name = 'TnlAuthenticationError';
  }
}

export class TnlRateLimitError extends TnlError {
  constructor(message: string, options: TnlErrorOptions = {}) {
    super(message, options);
    this.name = 'TnlRateLimitError';
  }
}

export class TnlTimeoutError extends TnlError {
  constructor(message = 'The Neural Ledger request timed out', options: TnlErrorOptions = {}) {
    super(message, options);
    this.name = 'TnlTimeoutError';
  }
}
