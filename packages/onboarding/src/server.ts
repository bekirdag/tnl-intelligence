import { readFile } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname } from 'node:path';
import {
  CredentialError,
  CredentialService,
  type CredentialActor,
  type DeveloperScope,
} from './credentials.js';
import { SessionError, type SessionAuthenticator } from './identity.js';
import { SampleCatalog } from './sample.js';
import { InMemoryUsageStore, ONBOARDING_CHECKPOINTS, type OnboardingCheckpoint } from './usage.js';

export interface OnboardingServerOptions {
  credentials: CredentialService;
  identity: SessionAuthenticator;
  usage: InMemoryUsageStore;
  sample?: SampleCatalog;
  openApiPath?: string | URL;
  publicUrl?: string;
  now?: () => number;
  publicSamplePerMinute?: number;
  sampleClientId?: (request: IncomingMessage) => string;
}

interface SampleRateDecision {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
}

class PublicSampleLimiter {
  readonly #limit: number;
  readonly #windows = new Map<string, { count: number; start: number }>();

  constructor(limit: number) {
    if (!Number.isInteger(limit) || limit < 1) {
      throw new Error('publicSamplePerMinute must be a positive integer');
    }
    this.#limit = limit;
  }

  consume(clientId: string, now: number): SampleRateDecision {
    const start = Math.floor(now / 60_000) * 60_000;
    const existing = this.#windows.get(clientId);
    const window = existing?.start === start ? existing : { count: 0, start };
    window.count += 1;
    this.#windows.set(clientId, window);
    return {
      allowed: window.count <= this.#limit,
      limit: this.#limit,
      remaining: Math.max(0, this.#limit - window.count),
      resetAt: start + 60_000,
    };
  }
}

export function createOnboardingServer(options: OnboardingServerOptions): Server {
  const sample = options.sample ?? new SampleCatalog();
  const now = options.now ?? Date.now;
  const sampleLimiter = new PublicSampleLimiter(options.publicSamplePerMinute ?? 100);
  const sampleClientId =
    options.sampleClientId ??
    ((request: IncomingMessage) => request.socket.remoteAddress ?? 'unknown');
  return createServer(
    { maxHeaderSize: 16_384, requestTimeout: 15_000 },
    async (request, response) => {
      response.setHeader('x-content-type-options', 'nosniff');
      response.setHeader('referrer-policy', 'no-referrer');
      try {
        const url = new URL(request.url ?? '/', options.publicUrl ?? 'http://127.0.0.1');
        if (request.method === 'GET' && url.pathname === '/healthz') {
          json(response, 200, { ok: true, service: 'tnl-developer-onboarding' });
          return;
        }
        if (request.method === 'GET' && url.pathname === '/favicon.ico') {
          response.writeHead(204).end();
          return;
        }
        if (request.method === 'GET' && url.pathname === '/openapi.json') {
          const document = await readFile(
            options.openApiPath ?? new URL('../../../openapi/tnl.openapi.json', import.meta.url),
            'utf8',
          );
          response
            .writeHead(200, {
              'content-type': 'application/json',
              'cache-control': 'public, max-age=300',
            })
            .end(document);
          return;
        }
        if (url.pathname.startsWith('/v1/')) {
          if (
            await handleSample(
              request,
              response,
              url,
              sample,
              sampleLimiter,
              sampleClientId(request),
              now(),
            )
          )
            return;
        }
        if (url.pathname.startsWith('/developer/api/')) {
          await handleDeveloper(request, response, url, options, now);
          return;
        }
        if (request.method === 'GET' || request.method === 'HEAD') {
          if (await servePublic(response, url.pathname, request.method === 'HEAD')) return;
        }
        json(
          response,
          404,
          errorBody('not_found', 'Use a documented sample or developer endpoint.'),
        );
      } catch (error) {
        const handled = normalizeError(error);
        json(response, handled.status, errorBody(handled.code, nextAction(handled.code)));
      }
    },
  );
}

async function handleSample(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  sample: SampleCatalog,
  limiter: PublicSampleLimiter,
  clientId: string,
  now: number,
): Promise<boolean> {
  const path = url.pathname.replace(/^\/v1\/sample/, '/v1');
  if (request.method === 'OPTIONS') {
    sampleHeaders(response);
    response.writeHead(204).end();
    return true;
  }
  const rate = limiter.consume(clientId, now);
  sampleHeaders(response, rate);
  if (!rate.allowed) {
    response.setHeader('retry-after', String(Math.max(1, Math.ceil((rate.resetAt - now) / 1_000))));
    json(
      response,
      429,
      errorBody('sample_rate_exhausted', 'Wait for the sample rate-limit window to reset.'),
    );
    return true;
  }
  if (request.method === 'GET' && (path === '/v1/news' || path === '/v1/search')) {
    const query = url.searchParams.get('q');
    const category = url.searchParams.get('category');
    const country = url.searchParams.get('country');
    const pageSize = integer(url.searchParams.get('page_size') ?? url.searchParams.get('limit'));
    const cursor = url.searchParams.get('cursor');
    const page = sample.page({
      ...(query ? { query } : {}),
      ...(category ? { category } : {}),
      ...(country ? { country } : {}),
      ...(pageSize === undefined ? {} : { pageSize }),
      ...(cursor ? { cursor } : {}),
    });
    sampleJson(response, 200, page);
    return true;
  }
  const story = path.match(/^\/v1\/news\/([^/]+)$/);
  if (request.method === 'GET' && story) {
    const item = sample.story(decodeURIComponent(story[1] as string));
    sampleJson(
      response,
      item ? 200 : 404,
      item ?? errorBody('not_found', 'Choose an ID returned by the sample news endpoint.'),
    );
    return true;
  }
  if (request.method === 'GET' && path === '/v1/entities') {
    sampleJson(response, 200, sample.entities());
    return true;
  }
  if (request.method === 'GET' && path === '/v1/impact-paths') {
    sampleJson(response, 200, sample.impactPaths());
    return true;
  }
  const related = path.match(/^\/v1\/(entities|impact-paths|assets)\/([^/]+)\/stories$/);
  if (request.method === 'GET' && related) {
    const kind = related[1];
    const value = decodeURIComponent(related[2] as string);
    const pageSize = integer(url.searchParams.get('page_size'));
    sampleJson(
      response,
      200,
      sample.page({
        ...(kind === 'entities' ? { entity: value } : {}),
        ...(kind === 'impact-paths' ? { impactPath: value } : {}),
        ...(kind === 'assets' ? { asset: value } : {}),
        ...(pageSize === undefined ? {} : { pageSize }),
      }),
    );
    return true;
  }
  if (request.method === 'GET' && path === '/v1/filters') {
    sampleJson(response, 200, {
      categories: [...new Set(sample.stories.map((story) => story.category))],
      countries: [...new Set(sample.stories.map((story) => story.country))],
      sample: sample.manifest,
    });
    return true;
  }
  if (request.method === 'GET' && path === '/v1/markets') {
    sampleJson(response, 200, {
      data: [{ ticker: 'NVDA', price: 100, currency: 'USD', delayed: true }],
      lastSyncAt: sample.manifest.generatedAt,
      sample: sample.manifest,
    });
    return true;
  }
  if (request.method === 'GET' && path === '/v1/me') {
    sampleJson(response, 200, {
      plan: 'static-sample',
      usage: { requests: 0, limit: 100 },
      sample: sample.manifest,
    });
    return true;
  }
  if (request.method === 'POST' && path === '/v1/ai-terminal') {
    await readBody(request, 16_384);
    sampleJson(response, 200, {
      data: {
        answer:
          'This static sample demonstrates the TNL research response shape. It does not run live research.',
        citations: sample.stories.slice(0, 1).flatMap((story) => story.sources ?? []),
        sample: sample.manifest,
      },
    });
    return true;
  }
  return false;
}

async function handleDeveloper(
  request: IncomingMessage,
  response: ServerResponse,
  url: URL,
  options: OnboardingServerOptions,
  now: () => number,
): Promise<void> {
  const actor = await options.identity.authenticate(request);
  response.setHeader('cache-control', 'no-store');
  if (request.method === 'GET' && url.pathname === '/developer/api/keys') {
    json(response, 200, { data: await options.credentials.list(actor) });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/developer/api/keys') {
    const body = await readBody(request, 16_384);
    const issued = await options.credentials.create(actor, {
      name: string(body.name),
      scopes: strings(body.scopes) as DeveloperScope[],
      ...(body.lifetimeDays === undefined ? {} : { lifetimeDays: Number(body.lifetimeDays) }),
    });
    json(response, 201, { data: issued });
    return;
  }
  const credential = url.pathname.match(/^\/developer\/api\/keys\/([^/]+)(?:\/(rotate|revoke))?$/);
  if (credential) {
    const id = decodeURIComponent(credential[1] as string);
    if (request.method === 'POST' && credential[2] === 'rotate') {
      json(response, 200, { data: await options.credentials.rotate(actor, id) });
      return;
    }
    if (request.method === 'POST' && credential[2] === 'revoke') {
      json(response, 200, { data: await options.credentials.revoke(actor, id) });
      return;
    }
    if (request.method === 'DELETE' && !credential[2]) {
      await options.credentials.delete(actor, id);
      response.writeHead(204).end();
      return;
    }
  }
  if (request.method === 'POST' && url.pathname === '/developer/api/authenticate') {
    const body = await readBody(request, 16_384);
    const credentialMetadata = await options.credentials.authenticate(string(body.apiKey));
    if (
      credentialMetadata.ownerId !== actor.ownerId ||
      credentialMetadata.tenantId !== actor.tenantId
    ) {
      throw new CredentialError('invalid_key', 401);
    }
    const quota = options.usage.consume(actor.tenantId, now());
    if (!quota.allowed) throw new CredentialError('quota_exhausted', 429);
    options.usage.checkpoint(actor.tenantId, 'api_first_success', now());
    json(response, 200, { data: { credential: credentialMetadata, quota } });
    return;
  }
  if (request.method === 'GET' && url.pathname === '/developer/api/usage') {
    json(response, 200, { data: options.usage.summary(actor.tenantId, now()) });
    return;
  }
  if (request.method === 'POST' && url.pathname === '/developer/api/checkpoints') {
    const body = await readBody(request, 4_096);
    const event = string(body.event);
    if (!(ONBOARDING_CHECKPOINTS as readonly string[]).includes(event)) {
      throw new CredentialError('invalid_checkpoint', 400);
    }
    options.usage.checkpoint(actor.tenantId, event as OnboardingCheckpoint, now());
    response.writeHead(204).end();
    return;
  }
  if (request.method === 'DELETE' && url.pathname === '/developer/api/account') {
    await options.credentials.deleteAccount(actor);
    response.writeHead(204).end();
    return;
  }
  json(response, 404, errorBody('not_found', 'Choose an available developer action.'));
}

async function servePublic(
  response: ServerResponse,
  pathname: string,
  head: boolean,
): Promise<boolean> {
  const route =
    pathname === '/'
      ? 'index.html'
      : pathname === '/app.js'
        ? 'app.js'
        : pathname === '/styles.css'
          ? 'styles.css'
          : pathname === '/postman/collection.json'
            ? 'postman/collection.json'
            : pathname === '/postman/environment.json'
              ? 'postman/environment.json'
              : undefined;
  if (!route) return false;
  const content = await readFile(new URL(`../public/${route}`, import.meta.url));
  response
    .writeHead(200, {
      'content-type': contentType(route),
      'cache-control': route.endsWith('.html') ? 'no-cache' : 'public, max-age=300',
      'content-security-policy':
        "default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'",
    })
    .end(head ? undefined : content);
  return true;
}

async function readBody(
  request: IncomingMessage,
  maximum: number,
): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += buffer.length;
    if (length > maximum) throw new CredentialError('body_too_large', 413);
    chunks.push(buffer);
  }
  try {
    const value = JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
    if (typeof value !== 'object' || value === null || Array.isArray(value)) throw new Error();
    return value as Record<string, unknown>;
  } catch {
    throw new CredentialError('invalid_json', 400);
  }
}

function sampleJson(response: ServerResponse, status: number, body: unknown): void {
  sampleHeaders(response);
  json(response, status, body);
}

function sampleHeaders(response: ServerResponse, rate?: SampleRateDecision): void {
  response.setHeader('access-control-allow-origin', '*');
  response.setHeader('access-control-allow-methods', 'GET, POST, OPTIONS');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('cache-control', 'public, max-age=300, stale-while-revalidate=86400');
  response.setHeader('x-tnl-data-mode', 'static-sample');
  if (rate) {
    response.setHeader('x-ratelimit-limit', String(rate.limit));
    response.setHeader('x-ratelimit-remaining', String(rate.remaining));
    response.setHeader('x-ratelimit-reset', String(Math.ceil(rate.resetAt / 1_000)));
  } else if (!response.hasHeader('x-ratelimit-limit')) {
    response.setHeader('x-ratelimit-limit', '100');
    response.setHeader('x-ratelimit-remaining', '100');
  }
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

function normalizeError(error: unknown): { code: string; status: number } {
  if (error instanceof CredentialError || error instanceof SessionError) return error;
  return { code: 'internal_error', status: 500 };
}

function errorBody(code: string, action: string) {
  return { error: { code, message: code.replaceAll('_', ' '), nextAction: action } };
}

function nextAction(code: string): string {
  const actions: Record<string, string> = {
    authentication_required: 'Sign in again before managing developer access.',
    recent_authentication_required: 'Reauthenticate, then retry the destructive action.',
    invalid_key: 'Create or rotate a developer key and use the one-time value.',
    quota_exhausted: 'Wait for the displayed UTC reset time.',
    key_limit: 'Revoke or delete an unused key before creating another.',
    create_rate: 'Wait until the next UTC day before creating another key.',
    not_found: 'Refresh the key list and retry with a key owned by this account.',
  };
  return actions[code] ?? 'Review the request and retry with documented values.';
}

function integer(value: string | null): number | undefined {
  if (value === null) return undefined;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function string(value: unknown): string {
  if (typeof value !== 'string') throw new CredentialError('invalid_request', 400);
  return value;
}

function strings(value: unknown): string[] {
  if (!Array.isArray(value) || !value.every((item) => typeof item === 'string')) {
    throw new CredentialError('invalid_request', 400);
  }
  return value;
}

function contentType(path: string): string {
  const extension = extname(path);
  if (extension === '.html') return 'text/html; charset=utf-8';
  if (extension === '.js') return 'text/javascript; charset=utf-8';
  if (extension === '.css') return 'text/css; charset=utf-8';
  return 'application/json';
}
