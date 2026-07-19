import { createReadStream } from 'node:fs';
import { readFile, stat } from 'node:fs/promises';
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { extname, resolve, sep } from 'node:path';
import type { ResearchTask } from './contracts.js';
import { TNL_BOT_PROFILE_URL } from './contracts.js';
import type { ResearchOrchestrator, ResearchRunContext } from './orchestrator.js';
import type { ResearchResultStore } from './store.js';
import { InMemoryResearchResultStore } from './store.js';
import { listResearchSkills } from './manifests.js';

export interface ResearchPrincipal {
  tenantId: string;
  actorId: string;
  scopes: ReadonlySet<'research:run' | 'research:read' | 'research:delete'>;
}

export interface ResearchHttpServerOptions {
  orchestrator: ResearchOrchestrator;
  authorize: (request: IncomingMessage) => Promise<ResearchPrincipal | undefined>;
  store?: ResearchResultStore;
  publicDirectory?: string;
  maxBodyBytes?: number;
  saveResults?: boolean;
}

export function createResearchHttpServer(options: ResearchHttpServerOptions): Server {
  const store = options.store ?? new InMemoryResearchResultStore();
  const publicDirectory = resolve(
    options.publicDirectory ?? resolve(import.meta.dirname, '../public'),
  );
  const metrics = { requests: 0, runs: 0, failures: 0, cancellations: 0 };
  return createServer(async (request, response) => {
    metrics.requests += 1;
    response.setHeader('x-content-type-options', 'nosniff');
    response.setHeader('referrer-policy', 'no-referrer');
    response.setHeader(
      'content-security-policy',
      "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
    );
    try {
      const url = new URL(request.url ?? '/', 'http://localhost');
      if (url.pathname === '/healthz') return json(response, 200, { ok: true });
      if (url.pathname === '/readyz') return json(response, 200, { ready: true });
      if (url.pathname === '/metrics')
        return text(
          response,
          200,
          Object.entries(metrics)
            .map(([key, value]) => `tnl_research_${key}_total ${value}`)
            .join('\n') + '\n',
          'text/plain; version=0.0.4',
        );
      if (url.pathname.startsWith('/api/')) {
        const principal = await options.authorize(request);
        if (!principal)
          return problem(response, 401, 'unauthorized', 'Authentication is required.');
        const requestId = header(request, 'x-request-id');
        const context: ResearchRunContext = {
          tenantId: principal.tenantId,
          actorId: principal.actorId,
          ...(requestId ? { requestId } : {}),
        };
        if (request.method === 'GET' && url.pathname === '/api/skills') {
          requireScope(principal, 'research:read');
          return json(response, 200, { data: listResearchSkills() });
        }
        if (request.method === 'GET' && url.pathname === '/api/tnl-bot') {
          requireScope(principal, 'research:read');
          return json(response, 200, {
            name: 'TNL Bot',
            profileUrl: TNL_BOT_PROFILE_URL,
            automated: true,
            methodology:
              'TNL Bot retrieves bounded evidence, separates source text from instructions, uses Codali through a server boundary, links claims to evidence, runs deterministic graders, and publishes corrections as revisions.',
            limitations:
              'Output may be incomplete, stale, or uncertain and does not represent firsthand reporting or trading advice.',
          });
        }
        if (request.method === 'POST' && url.pathname === '/api/research/runs') {
          requireScope(principal, 'research:run');
          const body = await readJson(request, options.maxBodyBytes ?? 64 * 1024);
          const task = ((body as { task?: unknown }).task ?? body) as ResearchTask;
          const result = await options.orchestrator.run(context, task);
          metrics.runs += 1;
          if (result.completionReason === 'cancelled') metrics.cancellations += 1;
          if (options.saveResults ?? true)
            await store.save(principal.tenantId, principal.actorId, result);
          return json(response, 200, { data: result });
        }
        const match = /^\/api\/research\/runs\/([A-Za-z0-9._:-]+)(?:\/export)?$/.exec(url.pathname);
        if (match) {
          const resultId = match[1] as string;
          if (request.method === 'GET') {
            requireScope(principal, 'research:read');
            const result = await store.get(principal.tenantId, resultId);
            if (!result)
              return problem(response, 404, 'not_found', 'Research result was not found.');
            if (url.pathname.endsWith('/export')) {
              const format = url.searchParams.get('format') ?? 'json';
              if (format === 'markdown')
                return text(response, 200, renderMarkdown(result), 'text/markdown; charset=utf-8');
              if (format !== 'json')
                return problem(response, 400, 'invalid_format', 'Export format is invalid.');
            }
            return json(response, 200, { data: result });
          }
          if (request.method === 'DELETE') {
            requireScope(principal, 'research:delete');
            const deleted = await store.delete(principal.tenantId, principal.actorId, resultId);
            return deleted
              ? json(response, 200, { deleted: true })
              : problem(
                  response,
                  404,
                  'not_found',
                  'Research result was not found or is not owned by this actor.',
                );
          }
        }
        return problem(response, 404, 'not_found', 'API route was not found.');
      }
      await serveStatic(publicDirectory, url.pathname, response);
    } catch (error) {
      metrics.failures += 1;
      const status =
        error instanceof HttpProblem ? error.status : error instanceof SyntaxError ? 400 : 500;
      const code =
        error instanceof HttpProblem
          ? error.code
          : status === 400
            ? 'invalid_json'
            : 'internal_error';
      const detail =
        status >= 500 ? 'Research service failed to process the request.' : safeMessage(error);
      problem(response, status, code, detail);
    }
  });
}

export async function listenResearchHttp(
  server: Server,
  options: { host?: string; port?: number } = {},
): Promise<{ host: string; port: number }> {
  const host = options.host ?? '127.0.0.1';
  const port = options.port ?? 7425;
  await new Promise<void>((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => {
      server.off('error', reject);
      resolvePromise();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string')
    throw new Error('Research server did not expose a TCP address');
  return { host, port: address.port };
}

async function serveStatic(
  root: string,
  pathname: string,
  response: ServerResponse,
): Promise<void> {
  const requested =
    pathname === '/' ? 'index.html' : decodeURIComponent(pathname).replace(/^\/+/, '');
  const path = resolve(root, requested);
  if (path !== root && !path.startsWith(`${root}${sep}`)) throw new HttpProblem(404, 'not_found');
  const info = await stat(path).catch(() => undefined);
  if (!info?.isFile()) throw new HttpProblem(404, 'not_found');
  response.statusCode = 200;
  response.setHeader('content-type', mime(path));
  response.setHeader(
    'cache-control',
    requested === 'index.html' ? 'no-store' : 'public, max-age=3600',
  );
  createReadStream(path).pipe(response);
}

async function readJson(request: IncomingMessage, maxBytes: number): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunkValue of request) {
    const chunk = Buffer.isBuffer(chunkValue) ? chunkValue : Buffer.from(chunkValue);
    size += chunk.length;
    if (size > maxBytes) throw new HttpProblem(413, 'body_too_large');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function requireScope(
  principal: ResearchPrincipal,
  scope: ResearchPrincipal['scopes'] extends ReadonlySet<infer T> ? T : never,
): void {
  if (!principal.scopes.has(scope)) throw new HttpProblem(403, 'forbidden');
}

function renderMarkdown(result: Awaited<ReturnType<ResearchResultStore['get']>> & {}): string {
  const claims = result.claims
    .map(
      (claim) =>
        `- ${claim.statement} ${claim.supportingEvidenceIds.map((id) => `[${id}]`).join(' ')}`,
    )
    .join('\n');
  const sources = result.citations
    .map(
      (citation) =>
        `- [${citation.evidenceId}] ${citation.url ? `[${citation.label}](${citation.url})` : citation.label}`,
    )
    .join('\n');
  return `# ${result.skill.id}\n\n${result.directAnswer}\n\n## Claims\n\n${claims || '- No supported claims.'}\n\n## Sources\n\n${sources || '- No sources.'}\n\n_Automated by TNL Bot. As of ${result.asOf}._\n`;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  text(response, status, `${JSON.stringify(body)}\n`, 'application/json; charset=utf-8');
}

function problem(response: ServerResponse, status: number, code: string, detail: string): void {
  response.setHeader('cache-control', 'no-store');
  json(response, status, {
    type: `https://theneuralledger.com/problems/${code}`,
    title: code,
    status,
    detail,
  });
}

function text(response: ServerResponse, status: number, body: string, contentType: string): void {
  response.statusCode = status;
  response.setHeader('content-type', contentType);
  response.end(body);
}

function header(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

function mime(path: string): string {
  return (
    {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'text/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.png': 'image/png',
    }[extname(path)] ?? 'application/octet-stream'
  );
}

function safeMessage(error: unknown): string {
  return error instanceof Error ? error.message.slice(0, 500) : 'Request failed.';
}

class HttpProblem extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
  ) {
    super(code);
  }
}
