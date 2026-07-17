import { TnlAuthenticationError, TnlError, TnlRateLimitError, TnlTimeoutError } from './errors.js';
import { buildNewsQuery, buildQuery, buildStoryQuery } from './query.js';
import type {
  TnlAccountResponse,
  TnlAiRequest,
  TnlAiResponse,
  TnlDataResponse,
  TnlFilters,
  TnlLookupQuery,
  TnlLookupResponse,
  TnlMarketResponse,
  TnlNewsPage,
  TnlNewsQuery,
  TnlRateLimit,
  TnlSavedSearch,
  TnlSavedSearchInput,
  TnlSavedSearchList,
  TnlSearchQuery,
  TnlStory,
  TnlStoryQuery,
} from './types.js';

const DEFAULT_BASE_URL = 'https://theneuralledger.com';
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 2;
const RETRYABLE_STATUSES = new Set([408, 425, 500, 502, 503, 504]);

export interface TnlClientOptions {
  apiKey: string;
  baseUrl?: string;
  timeoutMs?: number;
  retries?: number;
  fetch?: typeof globalThis.fetch;
  userAgent?: string;
}

interface RequestOptions {
  query?: URLSearchParams;
  body?: unknown;
  accept?: string;
  signal?: AbortSignal | undefined;
}

interface ErrorPayload {
  error?: { code?: string; message?: string; details?: unknown } | string;
  code?: string;
  message?: string;
  details?: unknown;
}

export class TnlClient {
  readonly baseUrl: string;
  readonly timeoutMs: number;
  readonly retries: number;
  readonly userAgent: string;
  lastRateLimit: TnlRateLimit | null = null;

  readonly #apiKey: string;
  readonly #fetch: typeof globalThis.fetch;

  constructor(options: TnlClientOptions) {
    const apiKey = options.apiKey?.trim();
    if (!apiKey) throw new TypeError('TNL API key is required');
    this.#apiKey = apiKey;
    this.baseUrl = normalizeBaseUrl(options.baseUrl || DEFAULT_BASE_URL);
    this.timeoutMs = normalizeNonNegativeInteger(options.timeoutMs, DEFAULT_TIMEOUT_MS);
    this.retries = normalizeNonNegativeInteger(options.retries, DEFAULT_RETRIES);
    this.#fetch = options.fetch || globalThis.fetch;
    if (!this.#fetch) throw new TypeError('A Fetch API implementation is required');
    this.userAgent = options.userAgent?.trim() || '@theneuralledger/sdk/0.1.0';
  }

  async getAccount(options: { signal?: AbortSignal } = {}): Promise<TnlAccountResponse> {
    return this.#request('GET', '/v1/me', { signal: options.signal });
  }

  async listNews(query: TnlNewsQuery = {}, signal?: AbortSignal): Promise<TnlNewsPage> {
    return this.#request('GET', '/v1/news', { query: buildNewsQuery(query), signal });
  }

  async *iterateNews(query: TnlNewsQuery = {}, signal?: AbortSignal): AsyncGenerator<TnlStory> {
    let cursor = query.cursor;
    const seenCursors = new Set<string>();
    do {
      const page = await this.listNews(cursor === undefined ? query : { ...query, cursor }, signal);
      for (const story of page.data) yield story;
      const nextCursor = page.page.next_cursor;
      if (!nextCursor || seenCursors.has(nextCursor)) return;
      seenCursors.add(nextCursor);
      cursor = nextCursor;
    } while (cursor);
  }

  async getNews(
    idOrSlug: string,
    query: TnlStoryQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlStory> {
    return this.#request('GET', `/v1/news/${encodePath(idOrSlug)}`, {
      query: buildStoryQuery(query),
      signal,
    });
  }

  async searchNews(query: TnlSearchQuery, signal?: AbortSignal): Promise<TnlNewsPage> {
    if (!query.query.trim()) throw new TypeError('Search query is required');
    return this.#request('GET', '/v1/search', {
      query: buildNewsQuery(query),
      signal,
    });
  }

  async listEntities(query: TnlLookupQuery = {}, signal?: AbortSignal): Promise<TnlLookupResponse> {
    return this.#request('GET', '/v1/entities', {
      query: buildQuery({ q: query.query, limit: query.limit }),
      signal,
    });
  }

  async getEntityStories(
    idOrValue: string,
    query: TnlNewsQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlNewsPage> {
    return this.#request('GET', `/v1/entities/${encodePath(idOrValue)}/stories`, {
      query: buildNewsQuery(query),
      signal,
    });
  }

  async listImpactPaths(
    query: TnlLookupQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlLookupResponse> {
    return this.#request('GET', '/v1/impact-paths', {
      query: buildQuery({ q: query.query, limit: query.limit }),
      signal,
    });
  }

  async getImpactPathStories(
    idOrValue: string,
    query: TnlNewsQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlNewsPage> {
    return this.#request('GET', `/v1/impact-paths/${encodePath(idOrValue)}/stories`, {
      query: buildNewsQuery(query),
      signal,
    });
  }

  async getAssetStories(
    ticker: string,
    query: TnlNewsQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlNewsPage> {
    return this.#request('GET', `/v1/assets/${encodePath(ticker)}/stories`, {
      query: buildNewsQuery(query),
      signal,
    });
  }

  async getFilters(signal?: AbortSignal): Promise<TnlFilters> {
    return this.#request('GET', '/v1/filters', { signal });
  }

  async getMarkets(signal?: AbortSignal): Promise<TnlMarketResponse> {
    return this.#request('GET', '/v1/markets', { signal });
  }

  async askAiTerminal(request: TnlAiRequest, signal?: AbortSignal): Promise<TnlAiResponse> {
    if (!request.question.trim()) throw new TypeError('Ledger AI question is required');
    return this.#request('POST', '/v1/ai-terminal', { body: request, signal });
  }

  async listSavedSearches(signal?: AbortSignal): Promise<TnlSavedSearchList> {
    return this.#request('GET', '/v1/saved-searches', { signal });
  }

  async createSavedSearch(
    input: TnlSavedSearchInput,
    signal?: AbortSignal,
  ): Promise<TnlDataResponse<TnlSavedSearch>> {
    return this.#request('POST', '/v1/saved-searches', { body: input, signal });
  }

  async getSavedSearch(id: string, signal?: AbortSignal): Promise<TnlDataResponse<TnlSavedSearch>> {
    return this.#request('GET', `/v1/saved-searches/${encodePath(id)}`, { signal });
  }

  async updateSavedSearch(
    id: string,
    input: Partial<TnlSavedSearchInput>,
    signal?: AbortSignal,
  ): Promise<TnlDataResponse<TnlSavedSearch>> {
    return this.#request('PUT', `/v1/saved-searches/${encodePath(id)}`, {
      body: input,
      signal,
    });
  }

  async deleteSavedSearch(id: string, signal?: AbortSignal): Promise<void> {
    await this.#request('DELETE', `/v1/saved-searches/${encodePath(id)}`, { signal });
  }

  async getSavedSearchResults(
    id: string,
    query: TnlNewsQuery = {},
    signal?: AbortSignal,
  ): Promise<TnlNewsPage> {
    return this.#request('GET', `/v1/saved-searches/${encodePath(id)}/results`, {
      query: buildNewsQuery(query),
      signal,
    });
  }

  async getFeed(
    format: 'rss' | 'atom',
    query: TnlNewsQuery = {},
    signal?: AbortSignal,
  ): Promise<string> {
    return this.#request('GET', `/v1/${format}`, {
      query: buildNewsQuery(query),
      accept: format === 'rss' ? 'application/rss+xml' : 'application/atom+xml',
      signal,
    });
  }

  async #request<T>(method: string, path: string, options: RequestOptions = {}): Promise<T> {
    const queryString = options.query?.toString();
    const url = `${this.baseUrl}${path}${queryString ? `?${queryString}` : ''}`;
    let lastError: unknown;

    for (let attempt = 0; attempt <= this.retries; attempt += 1) {
      const timeoutController = new AbortController();
      const timeout = setTimeout(() => timeoutController.abort('timeout'), this.timeoutMs);
      const signal = options.signal
        ? AbortSignal.any([options.signal, timeoutController.signal])
        : timeoutController.signal;
      try {
        const requestInit: RequestInit = {
          method,
          headers: {
            authorization: `Bearer ${this.#apiKey}`,
            accept: options.accept || 'application/json',
            'content-type': 'application/json',
            'user-agent': this.userAgent,
          },
          signal,
        };
        if (options.body !== undefined) requestInit.body = JSON.stringify(options.body);
        const response = await this.#fetch(url, requestInit);
        this.lastRateLimit = rateLimitFromHeaders(response.headers);

        if (!response.ok) {
          const error = await errorFromResponse(response);
          if (attempt < this.retries && RETRYABLE_STATUSES.has(response.status)) {
            lastError = error;
            await delay(retryDelayMs(attempt, response.headers), options.signal);
            continue;
          }
          throw error;
        }
        if (response.status === 204) return undefined as T;
        if (options.accept && options.accept !== 'application/json') {
          return (await response.text()) as T;
        }
        return (await response.json()) as T;
      } catch (error) {
        if (error instanceof TnlError) throw error;
        if (timeoutController.signal.aborted && !options.signal?.aborted) {
          lastError = new TnlTimeoutError(undefined, { cause: error });
        } else if (options.signal?.aborted) {
          throw options.signal.reason instanceof Error
            ? options.signal.reason
            : new DOMException('The operation was aborted', 'AbortError');
        } else {
          lastError = new TnlError('The Neural Ledger request failed', { cause: error });
        }
        if (attempt >= this.retries) throw lastError;
        await delay(retryDelayMs(attempt), options.signal);
      } finally {
        clearTimeout(timeout);
      }
    }
    throw lastError instanceof Error ? lastError : new TnlError('The Neural Ledger request failed');
  }
}

function normalizeBaseUrl(value: string): string {
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new TypeError('TNL base URL must use http or https');
  }
  return url.toString().replace(/\/$/, '');
}

function normalizeNonNegativeInteger(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!Number.isFinite(value) || value < 0) throw new TypeError('Expected a non-negative number');
  return Math.floor(value);
}

function encodePath(value: string): string {
  const normalized = value.trim();
  if (!normalized) throw new TypeError('Path identifier is required');
  return encodeURIComponent(normalized);
}

async function errorFromResponse(response: Response): Promise<TnlError> {
  const payload = (await response.json().catch(() => ({}))) as ErrorPayload;
  const nestedError = typeof payload.error === 'object' ? payload.error : undefined;
  const code = nestedError?.code || payload.code;
  const message =
    nestedError?.message ||
    (typeof payload.error === 'string' ? payload.error : undefined) ||
    payload.message ||
    `The Neural Ledger API returned HTTP ${response.status}`;
  const options = {
    status: response.status,
    details: nestedError?.details || payload.details,
    requestId: response.headers.get('x-request-id'),
    retryAfterSeconds: parseRetryAfter(response.headers.get('retry-after')),
    ...(code === undefined ? {} : { code }),
  };
  if (response.status === 401 || response.status === 403) {
    return new TnlAuthenticationError(message, options);
  }
  if (response.status === 429) return new TnlRateLimitError(message, options);
  return new TnlError(message, options);
}

function rateLimitFromHeaders(headers: Headers): TnlRateLimit | null {
  const limit = parseOptionalNumber(headers.get('x-ratelimit-limit'));
  const remaining = parseOptionalNumber(headers.get('x-ratelimit-remaining'));
  const resetAt = headers.get('x-ratelimit-reset');
  if (limit === null && remaining === null && !resetAt) return null;
  return { limit, remaining, resetAt };
}

function parseOptionalNumber(value: string | null): number | null {
  if (!value || value === 'unlimited') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseRetryAfter(value: string | null): number | null {
  if (!value) return null;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, Math.ceil((date - Date.now()) / 1000)) : null;
}

function retryDelayMs(attempt: number, headers?: Headers): number {
  const retryAfter = headers ? parseRetryAfter(headers.get('retry-after')) : null;
  if (retryAfter !== null) return Math.min(retryAfter * 1000, 5_000);
  return Math.min(250 * 2 ** attempt, 2_000);
}

async function delay(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        reject(signal.reason);
      },
      { once: true },
    );
  });
}
