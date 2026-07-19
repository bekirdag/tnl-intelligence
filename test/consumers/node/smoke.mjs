import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { access, chmod, readFile, stat } from 'node:fs/promises';
import { createServer } from 'node:net';
import { join, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {
  TnlAuthenticationError,
  TnlClient,
  TnlError,
  TnlRateLimitError,
  TnlTimeoutError,
} from '@theneuralledger/sdk';

const baseUrl = required('TNL_BASE_URL');
const apiKey = required('TNL_API_KEY');
const stateDirectory = resolve('.state');
const binDirectory = resolve('node_modules/.bin');
const tnlBin = join(binDirectory, process.platform === 'win32' ? 'tnl.cmd' : 'tnl');
const mcpBin = join(binDirectory, process.platform === 'win32' ? 'tnl-mcp.cmd' : 'tnl-mcp');

const checks = [];
await sdkChecks();
await cliChecks();
await mcpStdioChecks();
await mcpHttpChecks();

process.stdout.write(`${JSON.stringify({ ok: true, checks })}\n`);

async function sdkChecks() {
  const client = new TnlClient({ apiKey, baseUrl, retries: 0 });
  assert.doesNotMatch(JSON.stringify(client), new RegExp(apiKey));
  const page = await client.listNews({ pageSize: 2 });
  assert.deepEqual(
    page.data.map((story) => story.id),
    ['story-1', 'story-2'],
  );
  assert.equal(page.fixtureExtension, undefined);
  assert.equal(page.data[0]?.fixtureExtension, 'forward-compatible');
  const iterated = [];
  for await (const story of client.iterateNews({ pageSize: 2 })) iterated.push(story.id);
  assert.deepEqual(iterated, ['story-1', 'story-2', 'story-3']);
  assert.equal((await client.getNews('story-1')).author, 'TNL Bot');
  assert.equal((await client.searchNews({ query: 'semiconductors' })).query?.q, 'semiconductors');
  assert.match(
    (await client.askAiTerminal({ question: 'What changed?' })).data.answer || '',
    /controls/,
  );
  assert.equal((await client.listEntities()).data[0]?.id, 'entity-semiconductors');
  assert.equal((await client.listImpactPaths()).data[0]?.id, 'impact-export-controls');
  assert.equal((await client.getAssetStories('NVDA')).data[0]?.id, 'story-1');
  assert.equal((await client.getAccount()).plan?.id, 'fixture');
  assert.equal((await client.getMarkets()).data[0]?.symbol, 'TNLX');

  await rejects(
    () => new TnlClient({ apiKey: 'wrong_fixture_key', baseUrl, retries: 0 }).listNews(),
    TnlAuthenticationError,
    401,
  );
  await rejects(
    () => new TnlClient({ apiKey: 'tnl_forbidden_key', baseUrl, retries: 0 }).listNews(),
    TnlAuthenticationError,
    403,
  );
  await rejects(() => client.getNews('missing'), TnlError, 404);
  await rejects(() => client.getNews('conflict'), TnlError, 409);
  await rejects(() => client.searchNews({ query: 'scenario:429' }), TnlRateLimitError, 429);
  await rejects(() => client.searchNews({ query: 'scenario:500' }), TnlError, 500);
  await rejects(
    () =>
      new TnlClient({ apiKey, baseUrl, retries: 0, timeoutMs: 20 }).searchNews({
        query: 'scenario:slow',
      }),
    TnlTimeoutError,
  );
  await rejects(() => client.searchNews({ query: 'scenario:malformed' }), TnlError);
  await rejects(() => client.searchNews({ query: 'scenario:reset' }), TnlError);
  await assert.rejects(() => client.searchNews({ query: '   ' }), TypeError);
  checks.push('sdk-success-and-errors');
}

async function cliChecks() {
  const environment = { ...process.env, TNL_BASE_URL: baseUrl, TNL_API_KEY: apiKey };
  const help = command(tnlBin, ['--help'], environment);
  assert.match(help.stdout, /The Neural Ledger intelligence CLI/);
  const latest = command(tnlBin, ['latest', '--limit', '2', '--json'], environment);
  assert.deepEqual(
    JSON.parse(latest.stdout).data.map((story) => story.id),
    ['story-1', 'story-2'],
  );

  const first = command(tnlBin, ['daemon', '--once', '--state-dir', stateDirectory], environment);
  assert.match(first.stderr, /1\. Running: reading local state/);
  assert.match(first.stderr, /4\. Complete: cache and state committed/);
  command(tnlBin, ['daemon', '--once', '--state-dir', stateDirectory], environment);
  await fetch(`${baseUrl}/__control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ revision: 2 }),
  });
  command(tnlBin, ['daemon', '--once', '--state-dir', stateDirectory], environment);

  const eventsPath = join(stateDirectory, 'events.jsonl');
  const lines = (await readFile(eventsPath, 'utf8')).trim().split('\n');
  assert.equal(lines.length, 4);
  assert.match(lines.at(-1) || '', /revision 2/);
  assert.equal((await stat(eventsPath)).mode & 0o777, 0o600);
  await assert.rejects(access(join(stateDirectory, 'daemon.lock')), /ENOENT/);

  const failure = spawnSync(tnlBin, ['latest'], {
    cwd: process.cwd(),
    env: { ...environment, TNL_API_KEY: 'wrong_fixture_key' },
    encoding: 'utf8',
  });
  assert.notEqual(failure.status, 0);
  assert.doesNotMatch(`${failure.stdout}${failure.stderr}`, /wrong_fixture_key/);
  await chmod(stateDirectory, 0o700);
  checks.push('cli-and-daemon');
}

async function mcpStdioChecks() {
  const client = new Client({ name: 'tnl-artifact-harness', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: mcpBin,
    args: ['stdio'],
    env: { ...process.env, TNL_BASE_URL: baseUrl, TNL_API_KEY: apiKey },
    stderr: 'pipe',
  });
  await client.connect(transport);
  try {
    await assertMcpContract(client);
  } finally {
    await client.close();
  }
  checks.push('mcp-stdio');
}

async function mcpHttpChecks() {
  const port = await freePort();
  const environment = {
    ...process.env,
    TNL_BASE_URL: baseUrl,
    TNL_MCP_HOST: '127.0.0.1',
    TNL_MCP_PORT: String(port),
  };
  delete environment.TNL_API_KEY;
  const child = spawn(mcpBin, ['http'], {
    cwd: process.cwd(),
    env: environment,
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  child.stderr?.on('data', (chunk) => (stderr += chunk.toString()));
  try {
    await waitForHealth(`http://127.0.0.1:${port}/healthz`, child);
    const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
    assert.equal(unauthorized.status, 401);
    const client = new Client({ name: 'tnl-http-artifact-harness', version: '1.0.0' });
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${port}/mcp`), {
      requestInit: { headers: { authorization: `Bearer ${apiKey}` } },
    });
    await client.connect(transport);
    try {
      await assertMcpContract(client);
    } finally {
      await client.close();
    }
  } finally {
    child.kill('SIGTERM');
    await waitForExit(child);
  }
  assert.doesNotMatch(stderr, new RegExp(apiKey));
  checks.push('mcp-http');
}

async function assertMcpContract(client) {
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));
  assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 3);
  assert.equal((await client.listPrompts()).prompts.length, 2);
  const result = await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 2 } });
  assert.deepEqual(
    result.structuredContent.data.data.map((story) => story.id),
    ['story-1', 'story-2'],
  );
}

async function rejects(action, type, status) {
  await assert.rejects(action, (error) => {
    assert.ok(error instanceof type, `expected ${type.name}, received ${error?.constructor?.name}`);
    if (status !== undefined) assert.equal(error.status, status);
    assert.doesNotMatch(`${error.message}\n${error.stack || ''}`, new RegExp(apiKey));
    return true;
  });
}

function command(executable, args, environment) {
  const result = spawnSync(executable, args, {
    cwd: process.cwd(),
    env: environment,
    encoding: 'utf8',
    timeout: 30_000,
  });
  assert.equal(result.status, 0, `${executable} ${args.join(' ')}\n${result.stderr}`);
  return result;
}

async function freePort() {
  const server = createServer();
  await new Promise((resolvePromise, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Could not reserve an HTTP port');
  await new Promise((resolvePromise) => server.close(resolvePromise));
  return address.port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`MCP HTTP process exited with ${child.exitCode}`);
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 50));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

function waitForExit(child) {
  if (child.exitCode !== null) return Promise.resolve();
  return new Promise((resolvePromise) => child.once('exit', resolvePromise));
}

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
