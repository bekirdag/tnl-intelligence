#!/usr/bin/env node
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const directory = dirname(fileURLToPath(import.meta.url));
const fixtureDirectory = resolve(directory, '../fixtures/api');

const fixtures = {
  newsPage: await readJson('news-page.json'),
  newsPage2: await readJson('news-page-2.json'),
  account: await readJson('account.json'),
  markets: await readJson('markets.json'),
  ai: await readJson('ai-response.json'),
  lookups: await readJson('lookups.json'),
};

export const TEST_API_KEY = 'tnl_test_key';
export const FORBIDDEN_API_KEY = 'tnl_forbidden_key';

export async function startMockTnl(options = {}) {
  const state = {
    revision: 1,
    requestCount: 0,
    requests: [],
  };
  const server = createServer((request, response) => {
    void handleRequest(request, response, state, options).catch((error) => {
      if (!response.headersSent) {
        sendJson(response, 500, {
          error: { code: 'mock_internal_error', message: error.message },
        });
      } else {
        response.destroy(error);
      }
    });
  });
  const host = options.host || '127.0.0.1';
  const port = options.port ?? 0;
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(port, host, resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Mock TNL did not bind TCP');
  return {
    baseUrl: `http://${address.address.includes(':') ? `[${address.address}]` : address.address}:${address.port}`,
    server,
    state,
    close: () => new Promise((resolvePromise) => server.close(resolvePromise)),
  };
}

async function handleRequest(request, response, state, options) {
  const origin = `http://${request.headers.host || '127.0.0.1'}`;
  const url = new URL(request.url || '/', origin);
  state.requestCount += 1;
  state.requests.push({
    method: request.method || 'GET',
    path: url.pathname,
    query: Object.fromEntries(url.searchParams),
    authorized: typeof request.headers.authorization === 'string',
  });

  if (url.pathname === '/healthz' && request.method === 'GET') {
    sendJson(response, 200, { ok: true, service: 'mock-tnl', revision: state.revision });
    return;
  }
  if (url.pathname === '/__control' && request.method === 'POST') {
    const body = await readBody(request);
    if (body.revision !== undefined) {
      if (!Number.isInteger(body.revision) || body.revision < 1) {
        sendError(response, 400, 'invalid_revision', 'revision must be a positive integer');
        return;
      }
      state.revision = body.revision;
    }
    sendJson(response, 200, { revision: state.revision });
    return;
  }

  const token = bearerToken(request.headers.authorization);
  if (!token) {
    sendError(response, 401, 'unauthorized', 'Bearer API key is required');
    return;
  }
  if (token === FORBIDDEN_API_KEY) {
    sendError(response, 403, 'forbidden', 'The API key is not entitled to this resource');
    return;
  }
  if (token !== (options.apiKey || TEST_API_KEY)) {
    sendError(response, 401, 'invalid_api_key', 'The API key is invalid');
    return;
  }

  const scenario = scenarioFrom(url);
  if (scenario === 'slow') await delay(options.slowDelayMs ?? 250);
  if (scenario === 'reset') {
    request.socket.destroy();
    return;
  }
  if (scenario === 'malformed') {
    response.writeHead(200, commonHeaders({ 'content-type': 'application/json' }));
    response.end('{"data":');
    return;
  }
  const scenarioStatus = {
    conflict: 409,
    'rate-limit': 429,
    failure: 500,
  }[scenario];
  if (scenarioStatus) {
    const headers = scenarioStatus === 429 ? { 'retry-after': '0' } : {};
    sendError(response, scenarioStatus, `fixture_${scenario}`, `Fixture ${scenario}`, headers);
    return;
  }

  if (url.pathname === '/v1/news' || url.pathname === '/v1/news-stories') {
    sendJson(response, 200, pageFor(url, state.revision));
    return;
  }
  if (url.pathname === '/v1/search') {
    const page = pageFor(url, state.revision);
    page.query = { q: url.searchParams.get('q') || '' };
    sendJson(response, 200, page);
    return;
  }
  if (/^\/v1\/(news|news-stories)\//.test(url.pathname)) {
    const id = decodeURIComponent(url.pathname.split('/').at(-1) || '');
    if (id === 'missing') {
      sendError(response, 404, 'not_found', 'Fixture story was not found');
      return;
    }
    if (id === 'conflict') {
      sendError(response, 409, 'conflict', 'Fixture story is being revised');
      return;
    }
    const story = allStories(state.revision).find((item) => item.id === id || item.slug === id);
    if (!story) {
      sendError(response, 404, 'not_found', 'Fixture story was not found');
      return;
    }
    sendJson(response, 200, story);
    return;
  }
  if (url.pathname === '/v1/entities') {
    sendJson(response, 200, fixtures.lookups.entities);
    return;
  }
  if (url.pathname === '/v1/impact-paths') {
    sendJson(response, 200, fixtures.lookups.impactPaths);
    return;
  }
  if (
    /^\/v1\/(entities|impact-paths|assets)\/.+\/stories$/.test(url.pathname) ||
    /^\/v1\/assets\/.+\/stories$/.test(url.pathname)
  ) {
    sendJson(response, 200, pageFor(url, state.revision));
    return;
  }
  if (url.pathname === '/v1/filters') {
    sendJson(response, 200, {
      categories: ['Technology', 'Supply Chain', 'Energy'],
      countries: ['US', 'NL'],
      lastSyncAt: '2026-07-18T08:30:00.000Z',
    });
    return;
  }
  if (url.pathname === '/v1/markets') {
    sendJson(response, 200, fixtures.markets);
    return;
  }
  if (url.pathname === '/v1/me') {
    sendJson(response, 200, fixtures.account);
    return;
  }
  if (url.pathname === '/v1/ai-terminal' && request.method === 'POST') {
    await readBody(request);
    sendJson(response, 200, fixtures.ai);
    return;
  }
  sendError(response, 404, 'not_found', 'Fixture route was not found');
}

function pageFor(url, revision) {
  const source =
    url.searchParams.get('cursor') === 'fixture-page-2' ? fixtures.newsPage2 : fixtures.newsPage;
  const page = structuredClone(source);
  page.data = page.data.map((story) => reviseStory(story, revision));
  const requestedSize = Number(url.searchParams.get('page_size'));
  if (Number.isInteger(requestedSize) && requestedSize > 0) page.page.page_size = requestedSize;
  return page;
}

function allStories(revision) {
  return [...fixtures.newsPage.data, ...fixtures.newsPage2.data].map((story) =>
    reviseStory(story, revision),
  );
}

function reviseStory(story, revision) {
  const result = structuredClone(story);
  if (result.id === 'story-1' && revision > 1) {
    result.title = `Semiconductor export controls expand (revision ${revision})`;
    result.updatedAt = `2026-07-18T0${Math.min(9, 8 + revision)}:15:00.000Z`;
    result.revision = revision;
  }
  return result;
}

function scenarioFrom(url) {
  const value = url.searchParams.get('q') || url.searchParams.get('category') || '';
  return {
    'scenario:slow': 'slow',
    'scenario:reset': 'reset',
    'scenario:malformed': 'malformed',
    'scenario:409': 'conflict',
    'scenario:429': 'rate-limit',
    'scenario:500': 'failure',
  }[value];
}

function bearerToken(value) {
  const match = value?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim();
}

async function readBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (chunks.length === 0) return {};
  const value = JSON.parse(Buffer.concat(chunks).toString('utf8'));
  return value && typeof value === 'object' ? value : {};
}

function sendError(response, status, code, message, headers = {}) {
  sendJson(
    response,
    status,
    { error: { code, message }, requestId: `req_fixture_${status}` },
    headers,
  );
}

function sendJson(response, status, body, headers = {}) {
  response.writeHead(
    status,
    commonHeaders({ 'content-type': 'application/json; charset=utf-8', ...headers }),
  );
  response.end(`${JSON.stringify(body)}\n`);
}

function commonHeaders(headers = {}) {
  return {
    'cache-control': 'no-store',
    'x-request-id': 'req_fixture',
    'x-ratelimit-limit': '1000',
    'x-ratelimit-remaining': '999',
    'x-ratelimit-reset': '2026-07-18T09:00:00.000Z',
    ...headers,
  };
}

function delay(milliseconds) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

async function readJson(name) {
  return JSON.parse(await readFile(resolve(fixtureDirectory, name), 'utf8'));
}

function parseArguments(argv) {
  const result = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--host') result.host = argv[index + 1];
    if (argv[index] === '--port') result.port = Number(argv[index + 1]);
  }
  return result;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  const mock = await startMockTnl(parseArguments(process.argv.slice(2)));
  process.stdout.write(`${JSON.stringify({ baseUrl: mock.baseUrl })}\n`);
  const close = async () => {
    await mock.close();
    process.exit(0);
  };
  process.once('SIGINT', () => void close());
  process.once('SIGTERM', () => void close());
}
