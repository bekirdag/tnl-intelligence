import { createHash } from 'node:crypto';
import { readFile, stat } from 'node:fs/promises';
import { dirname, isAbsolute, resolve } from 'node:path';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  StdioClientTransport,
  getDefaultEnvironment,
} from '@modelcontextprotocol/sdk/client/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

export const DOCTOR_EXIT = {
  ok: 0,
  configuration: 10,
  runtime: 20,
  integrity: 21,
  credential: 30,
  api: 31,
  mcp: 40,
  oauthTls: 50,
} as const;

export type DoctorMode = 'local' | 'remote';
export type DoctorStatus = 'pass' | 'warn' | 'fail' | 'skip';

export interface DoctorCheck {
  id: string;
  status: DoctorStatus;
  message: string;
  details?: Readonly<Record<string, unknown>>;
}

export interface DoctorOptions {
  mode: DoctorMode;
  entrypoint?: string;
  remoteUrl?: string;
  apiBaseUrl?: string;
  apiKey?: string;
  configPath?: string;
  integrityPath?: string;
  timeoutMs?: number;
  skipApi?: boolean;
}

export interface DoctorReport {
  schemaVersion: '1.0';
  mode: DoctorMode;
  ok: boolean;
  exitCode: number;
  checks: readonly DoctorCheck[];
  redaction: { credentialsPrinted: false };
}

export async function runDoctor(options: DoctorOptions): Promise<DoctorReport> {
  const checks: DoctorCheck[] = [];
  checks.push(runtimeCheck());
  if (options.configPath) checks.push(await configCheck(options.configPath));
  else
    checks.push({
      id: 'configuration',
      status: 'skip',
      message: 'No client configuration supplied.',
    });
  if (options.integrityPath) checks.push(await integrityCheck(options.integrityPath));
  else checks.push({ id: 'integrity', status: 'skip', message: 'No integrity manifest supplied.' });

  if (options.mode === 'local') await localChecks(options, checks);
  else await remoteChecks(options, checks);

  const exitCode = reportExitCode(checks);
  return {
    schemaVersion: '1.0',
    mode: options.mode,
    ok: exitCode === DOCTOR_EXIT.ok,
    exitCode,
    checks,
    redaction: { credentialsPrinted: false },
  };
}

async function localChecks(options: DoctorOptions, checks: DoctorCheck[]): Promise<void> {
  const entrypoint = options.entrypoint;
  if (!entrypoint) {
    checks.push({
      id: 'runtime.entrypoint',
      status: 'fail',
      message: 'Local MCP entrypoint is required.',
    });
    return;
  }
  const resolved = resolve(entrypoint);
  try {
    const metadata = await stat(resolved);
    if (!metadata.isFile()) throw new TypeError('not a regular file');
    checks.push({
      id: 'runtime.entrypoint',
      status: 'pass',
      message: 'Local MCP entrypoint is readable.',
    });
  } catch (error) {
    checks.push({
      id: 'runtime.entrypoint',
      status: 'fail',
      message: `Local MCP entrypoint is unavailable: ${safeError(error)}`,
    });
    return;
  }

  const apiKey = options.apiKey;
  checks.push(
    apiKey
      ? { id: 'credential.tnl', status: 'pass', message: 'TNL_API_KEY is present and redacted.' }
      : { id: 'credential.tnl', status: 'fail', message: 'TNL_API_KEY is missing.' },
  );
  if (!apiKey) return;

  if (options.skipApi) {
    checks.push({
      id: 'api.reachability',
      status: 'skip',
      message: 'API probe disabled explicitly.',
    });
  } else {
    checks.push(
      await apiCheck(
        options.apiBaseUrl ?? 'https://theneuralledger.com',
        apiKey,
        options.timeoutMs ?? 10_000,
      ),
    );
  }
  checks.push(await localMcpCheck(resolved, options));
}

async function remoteChecks(options: DoctorOptions, checks: DoctorCheck[]): Promise<void> {
  if (!options.remoteUrl) {
    checks.push({ id: 'oauth.remote-url', status: 'fail', message: 'Remote MCP URL is required.' });
    return;
  }
  let url: URL;
  try {
    url = new URL(options.remoteUrl);
    if (url.username || url.password) throw new TypeError('credentials in URL are not allowed');
    if (url.protocol !== 'https:' && !isLoopback(url))
      throw new TypeError('remote MCP must use HTTPS outside loopback');
    checks.push({
      id: 'oauth.remote-url',
      status: url.protocol === 'https:' ? 'pass' : 'warn',
      message:
        url.protocol === 'https:'
          ? 'Remote MCP URL uses HTTPS.'
          : 'Loopback development MCP uses HTTP.',
    });
  } catch (error) {
    checks.push({ id: 'oauth.remote-url', status: 'fail', message: safeError(error) });
    return;
  }
  checks.push(await oauthMetadataCheck(url, options.timeoutMs ?? 10_000));
  if (options.apiKey) checks.push(await remoteMcpCheck(url, options));
  else {
    checks.push({
      id: 'mcp.remote',
      status: 'skip',
      message:
        'Remote MCP protocol probe requires host OAuth or an explicit development bearer token.',
    });
  }
}

function runtimeCheck(): DoctorCheck {
  const major = Number.parseInt(process.versions.node.split('.')[0] ?? '0', 10);
  return major >= 20
    ? {
        id: 'runtime.node',
        status: 'pass',
        message: `Node ${process.versions.node} satisfies the supported runtime range.`,
        details: { platform: process.platform, architecture: process.arch },
      }
    : {
        id: 'runtime.node',
        status: 'fail',
        message: `Node ${process.versions.node} is unsupported; Node 20.10 or newer is required.`,
      };
}

async function configCheck(path: string): Promise<DoctorCheck> {
  try {
    const value: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!value || typeof value !== 'object')
      throw new TypeError('configuration root must be an object');
    return { id: 'configuration', status: 'pass', message: 'Client configuration is valid JSON.' };
  } catch (error) {
    return {
      id: 'configuration',
      status: 'fail',
      message: `Client configuration is invalid: ${safeError(error)}`,
    };
  }
}

interface IntegrityManifest {
  files: Array<{ path: string; sha256: string }>;
}

async function integrityCheck(path: string): Promise<DoctorCheck> {
  try {
    const value = JSON.parse(await readFile(path, 'utf8')) as IntegrityManifest;
    if (!Array.isArray(value.files) || value.files.length === 0)
      throw new TypeError('integrity manifest has no files');
    const root = dirname(resolve(path));
    for (const item of value.files) {
      if (!item.path || isAbsolute(item.path) || item.path.includes('..'))
        throw new TypeError('integrity file paths must be relative');
      const content = await readFile(resolve(root, item.path));
      const actual = createHash('sha256').update(content).digest('hex');
      if (actual !== item.sha256) throw new TypeError(`hash mismatch for ${item.path}`);
    }
    return {
      id: 'integrity',
      status: 'pass',
      message: `Verified ${value.files.length} integrity entries.`,
    };
  } catch (error) {
    return {
      id: 'integrity',
      status: 'fail',
      message: `Integrity verification failed: ${safeError(error)}`,
    };
  }
}

async function apiCheck(baseUrl: string, apiKey: string, timeoutMs: number): Promise<DoctorCheck> {
  try {
    const url = new URL('/v1/me', baseUrl);
    const response = await timedFetch(
      url,
      {
        headers: { authorization: `Bearer ${apiKey}`, accept: 'application/json' },
      },
      timeoutMs,
    );
    if (response.status === 401 || response.status === 403)
      return {
        id: 'api.authorization',
        status: 'fail',
        message: 'TNL API rejected the credential.',
      };
    if (!response.ok)
      return {
        id: 'api.reachability',
        status: 'fail',
        message: `TNL API returned HTTP ${response.status}.`,
      };
    return {
      id: 'api.reachability',
      status: 'pass',
      message: 'TNL API is reachable and accepted the credential.',
      details: dateSkew(response),
    };
  } catch (error) {
    return {
      id: 'api.reachability',
      status: 'fail',
      message: `TNL API probe failed: ${safeError(error)}`,
    };
  }
}

async function localMcpCheck(entrypoint: string, options: DoctorOptions): Promise<DoctorCheck> {
  const client = new Client({ name: 'tnl-connection-doctor', version: '1.0.0' });
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [entrypoint],
    env: {
      ...getDefaultEnvironment(),
      TNL_API_KEY: options.apiKey ?? '',
      ...(options.apiBaseUrl ? { TNL_BASE_URL: options.apiBaseUrl } : {}),
    },
    stderr: 'pipe',
  });
  try {
    await client.connect(transport, { timeout: options.timeoutMs ?? 10_000 });
    const tools = await client.listTools(undefined, { timeout: options.timeoutMs ?? 10_000 });
    if (!tools.tools.some((tool) => tool.name === 'tnl_latest_news'))
      throw new TypeError('tnl_latest_news is not advertised');
    await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 1 } }, undefined, {
      timeout: options.timeoutMs ?? 10_000,
    });
    return {
      id: 'mcp.local',
      status: 'pass',
      message: 'MCP initialized and the safe read-only probe succeeded.',
      details: { toolCount: tools.tools.length },
    };
  } catch (error) {
    return { id: 'mcp.local', status: 'fail', message: `MCP probe failed: ${safeError(error)}` };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function remoteMcpCheck(url: URL, options: DoctorOptions): Promise<DoctorCheck> {
  const client = new Client({ name: 'tnl-connection-doctor', version: '1.0.0' });
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers: { authorization: `Bearer ${options.apiKey ?? ''}` } },
  });
  try {
    // SDK 1.29's HTTP transport declaration conflicts with exactOptionalPropertyTypes.
    await client.connect(transport as unknown as Transport, {
      timeout: options.timeoutMs ?? 10_000,
    });
    const tools = await client.listTools(undefined, { timeout: options.timeoutMs ?? 10_000 });
    if (tools.tools.length === 0) throw new TypeError('remote MCP exposes no tools');
    return {
      id: 'mcp.remote',
      status: 'pass',
      message: 'Remote MCP initialized successfully.',
      details: { toolCount: tools.tools.length },
    };
  } catch (error) {
    return {
      id: 'mcp.remote',
      status: 'fail',
      message: `Remote MCP probe failed: ${safeError(error)}`,
    };
  } finally {
    await client.close().catch(() => undefined);
  }
}

async function oauthMetadataCheck(url: URL, timeoutMs: number): Promise<DoctorCheck> {
  try {
    const metadataUrl = new URL('/.well-known/oauth-protected-resource', url.origin);
    const response = await timedFetch(
      metadataUrl,
      { headers: { accept: 'application/json' } },
      timeoutMs,
    );
    if (!response.ok) throw new TypeError(`metadata returned HTTP ${response.status}`);
    const body = (await response.json()) as {
      resource?: unknown;
      authorization_servers?: unknown;
      scopes_supported?: unknown;
    };
    if (typeof body.resource !== 'string' || !Array.isArray(body.authorization_servers))
      throw new TypeError('metadata is missing resource or authorization_servers');
    return {
      id: 'oauth.metadata',
      status: 'pass',
      message: 'OAuth protected-resource metadata is valid.',
      details: {
        authorizationServerCount: body.authorization_servers.length,
        scopeCount: Array.isArray(body.scopes_supported) ? body.scopes_supported.length : 0,
        ...dateSkew(response),
      },
    };
  } catch (error) {
    return {
      id: 'oauth.metadata',
      status: 'fail',
      message: `OAuth metadata probe failed: ${safeError(error)}`,
    };
  }
}

async function timedFetch(url: URL, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal, redirect: 'error' });
  } finally {
    clearTimeout(timer);
  }
}

function dateSkew(response: Response): Readonly<Record<string, unknown>> {
  const value = response.headers.get('date');
  if (!value) return { serverClockSkewMs: null };
  const skew = Date.parse(value) - Date.now();
  return {
    serverClockSkewMs: Number.isFinite(skew) ? skew : null,
    clockSkewWarning: Math.abs(skew) > 300_000,
  };
}

function reportExitCode(checks: readonly DoctorCheck[]): number {
  const failed = checks.filter((check) => check.status === 'fail').map((check) => check.id);
  if (failed.length === 0) return DOCTOR_EXIT.ok;
  if (failed.includes('configuration')) return DOCTOR_EXIT.configuration;
  if (failed.some((id) => id.startsWith('runtime.'))) return DOCTOR_EXIT.runtime;
  if (failed.includes('integrity')) return DOCTOR_EXIT.integrity;
  if (failed.some((id) => id.startsWith('oauth.'))) return DOCTOR_EXIT.oauthTls;
  if (failed.some((id) => id.startsWith('mcp.'))) return DOCTOR_EXIT.mcp;
  if (failed.some((id) => id.startsWith('api.'))) return DOCTOR_EXIT.api;
  if (failed.some((id) => id.startsWith('credential.'))) return DOCTOR_EXIT.credential;
  return DOCTOR_EXIT.configuration;
}

function safeError(error: unknown): string {
  const text = error instanceof Error ? error.message : String(error);
  return text
    .replace(/(bearer|token|key|secret|password)([=: ]+)[^\s,;]+/gi, '$1$2[redacted]')
    .replace(/https?:\/\/[^\s/@]+:[^\s/@]+@/g, 'https://[redacted]@')
    .slice(0, 300);
}

function isLoopback(url: URL): boolean {
  return ['127.0.0.1', 'localhost', '::1', '[::1]'].includes(url.hostname);
}
