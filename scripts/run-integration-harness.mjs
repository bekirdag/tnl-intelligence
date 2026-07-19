#!/usr/bin/env node
import { execFileSync, spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  access,
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { TEST_API_KEY } from '../test/mock-tnl/server.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifactRoot = resolve(root, process.env.TNL_HARNESS_ARTIFACTS || '.artifacts/tool-01');
const npmArtifactDirectory = join(artifactRoot, 'npm');
const pythonArtifactDirectory = join(artifactRoot, 'python');
const evidencePath = join(artifactRoot, 'evidence.json');
const skipContainer = process.argv.includes('--skip-container');
const liveSmokeEnabled = process.env.TNL_HARNESS_LIVE === '1';
const cleanupTasks = [];
const signalController = new AbortController();
const signalHandlers = new Map(
  ['SIGINT', 'SIGTERM'].map((signal) => [
    signal,
    () => signalController.abort(new Error(`Integration harness received ${signal}`)),
  ]),
);
for (const [signal, handler] of signalHandlers) process.once(signal, handler);
const evidence = {
  schemaVersion: 1,
  tool: '01-local-integration-harness',
  status: 'running',
  startedAt: new Date().toISOString(),
  commit: commandOutput('git', ['rev-parse', 'HEAD']),
  environment: {
    platform: process.platform,
    architecture: process.arch,
    node: process.version,
    npm: commandOutput('npm', ['--version']),
    python: '',
    docker: skipContainer ? 'skipped by explicit flag' : '',
  },
  artifacts: [],
  stages: [],
  cleanup: [],
};

let stageNumber = 0;
let temporaryRoot;
let mock;
let nodeConsumerDirectory;

try {
  await prepare();
  await stage('validate fixtures and start deterministic mock API', fixtureStage);
  await stage('build and install local npm package artifacts', nodeArtifactStage);
  await stage('exercise SDK, CLI, daemon, and MCP package consumers', nodeConsumerStage);
  if (liveSmokeEnabled) await stage('run bounded read-only live smoke', liveSmokeStage);
  else evidence.stages.push({ name: 'bounded read-only live smoke', status: 'skipped' });
  await stage('build and install Python wheel and source artifacts', pythonArtifactStage);
  if (skipContainer) {
    evidence.stages.push({ name: 'container artifact smoke', status: 'skipped' });
  } else {
    await stage('build and exercise non-root container artifacts', containerStage);
  }
  await stage('inspect artifacts and scan evidence for secrets', inspectionStage);
  evidence.status = 'passed';
} catch (error) {
  evidence.status = 'failed';
  evidence.failure = safeError(error);
  process.exitCode = 1;
} finally {
  await cleanup();
  evidence.finishedAt = new Date().toISOString();
  evidence.durationMs = Date.parse(evidence.finishedAt) - Date.parse(evidence.startedAt);
  await mkdir(dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  await assertPrivate(evidencePath);
  for (const [signal, handler] of signalHandlers) process.removeListener(signal, handler);
  process.stdout.write(
    `${evidence.status === 'passed' ? '7. Complete' : '7. Failed'}: evidence written to ${relative(evidencePath)}\n`,
  );
}

if (evidence.status !== 'passed') {
  throw new Error(evidence.failure?.message || 'Tool 01 integration harness failed');
}

async function prepare() {
  await rm(artifactRoot, { recursive: true, force: true });
  await mkdir(npmArtifactDirectory, { recursive: true });
  await mkdir(pythonArtifactDirectory, { recursive: true });
  temporaryRoot = await mkdtemp(join(tmpdir(), 'tnl-tool-01-'));
  cleanupTasks.push(async () => rm(temporaryRoot, { recursive: true, force: true }));
}

async function fixtureStage() {
  const openapi = JSON.parse(await readFile(join(root, 'openapi/tnl.openapi.json'), 'utf8'));
  const requiredPaths = [
    '/v1/me',
    '/v1/ai-terminal',
    '/v1/news',
    '/v1/news/{idOrSlug}',
    '/v1/search',
    '/v1/entities',
    '/v1/impact-paths',
    '/v1/assets/{idOrSlug}/stories',
    '/v1/filters',
    '/v1/markets',
  ];
  for (const path of requiredPaths) {
    if (!openapi.paths?.[path]) throw new Error(`OpenAPI snapshot is missing ${path}`);
  }
  for (const name of ['news-page.json', 'news-page-2.json']) {
    const fixture = JSON.parse(await readFile(join(root, 'test/fixtures/api', name), 'utf8'));
    validateNewsPage(fixture, name);
  }
  run('node', ['--test', 'test/integration/mock-tnl.test.mjs']);
  mock = await startMockProcess();
  cleanupTasks.push(async () => stopChild(mock.process));
  const health = await fetch(`${mock.baseUrl}/healthz`);
  if (!health.ok) throw new Error('Mock TNL health check failed');
  return { openapi: openapi.openapi, requiredPathCount: requiredPaths.length };
}

async function nodeArtifactStage() {
  run('npm', ['run', 'build']);
  run('npm', ['run', 'pack:check']);
  const workspaces = [
    '@theneuralledger/sdk',
    '@theneuralledger/research',
    '@theneuralledger/mcp',
    '@theneuralledger/cli',
  ];
  const tarballs = [];
  for (const workspace of workspaces) {
    const output = run('npm', [
      'pack',
      '--json',
      '--workspace',
      workspace,
      '--pack-destination',
      npmArtifactDirectory,
    ]);
    const [manifest] = JSON.parse(output.stdout);
    if (!manifest?.filename) throw new Error(`npm pack did not return a filename for ${workspace}`);
    const path = join(npmArtifactDirectory, manifest.filename);
    tarballs.push(path);
    evidence.artifacts.push(
      await artifactEvidence(
        path,
        workspace,
        manifest.files?.map((file) => file.path),
      ),
    );
  }

  nodeConsumerDirectory = join(temporaryRoot, 'node-consumer');
  await mkdir(nodeConsumerDirectory, { recursive: true });
  await writeFile(
    join(nodeConsumerDirectory, 'package.json'),
    `${JSON.stringify({ name: 'tnl-clean-consumer', private: true, type: 'module' }, null, 2)}\n`,
  );
  await cp(join(root, 'test/consumers/node/smoke.mjs'), join(nodeConsumerDirectory, 'smoke.mjs'));
  await cp(
    join(root, 'test/consumers/node/mcp-http-smoke.mjs'),
    join(nodeConsumerDirectory, 'mcp-http-smoke.mjs'),
  );
  await cp(
    join(root, 'test/consumers/node/live-smoke.mjs'),
    join(nodeConsumerDirectory, 'live-smoke.mjs'),
  );
  run(
    'npm',
    [
      'install',
      '--ignore-scripts',
      '--no-audit',
      '--no-fund',
      ...tarballs.map((path) => resolve(path)),
    ],
    { cwd: nodeConsumerDirectory, timeout: 180_000 },
  );
  const installed = JSON.parse(
    await readFile(
      join(nodeConsumerDirectory, 'node_modules/@theneuralledger/sdk/package.json'),
      'utf8',
    ),
  );
  if (installed.version !== '0.1.0') throw new Error('Clean npm consumer installed the wrong SDK');
  return { workspaces, consumer: 'isolated temporary npm project' };
}

async function nodeConsumerStage() {
  const result = run('node', ['smoke.mjs'], {
    cwd: nodeConsumerDirectory,
    env: { ...process.env, TNL_BASE_URL: mock.baseUrl, TNL_API_KEY: TEST_API_KEY },
    timeout: 120_000,
  });
  const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
  if (!summary.ok) throw new Error('Node artifact consumer did not report success');
  return summary;
}

async function liveSmokeStage() {
  const liveApiKey = process.env.TNL_API_KEY?.trim();
  if (!liveApiKey) throw new Error('TNL_API_KEY is required when TNL_HARNESS_LIVE=1');
  const result = run('node', ['live-smoke.mjs'], {
    cwd: nodeConsumerDirectory,
    env: {
      ...process.env,
      TNL_API_KEY: liveApiKey,
      TNL_BASE_URL: process.env.TNL_LIVE_BASE_URL || 'https://theneuralledger.com',
    },
    timeout: 45_000,
  });
  const summary = JSON.parse(result.stdout.trim());
  return { requestCount: summary.requestCount, returned: summary.returned };
}

async function pythonArtifactStage() {
  const buildPython = await existingPython();
  evidence.environment.python = commandOutput(buildPython, ['--version']);
  const pythonProject = join(root, 'python/tnl_intelligence');
  run(buildPython, ['-m', 'ruff', 'check', '.'], { cwd: pythonProject, timeout: 120_000 });
  run(buildPython, ['-m', 'ruff', 'format', '--check', '.'], {
    cwd: pythonProject,
    timeout: 120_000,
  });
  run(buildPython, ['-m', 'mypy', 'src'], { cwd: pythonProject, timeout: 120_000 });
  run(buildPython, ['-m', 'pytest'], { cwd: pythonProject, timeout: 120_000 });
  run(buildPython, ['-m', 'build', '--outdir', pythonArtifactDirectory], {
    cwd: pythonProject,
    timeout: 180_000,
  });
  const names = await readdir(pythonArtifactDirectory);
  const wheel = join(pythonArtifactDirectory, requiredMatch(names, /\.whl$/));
  const source = join(pythonArtifactDirectory, requiredMatch(names, /\.tar\.gz$/));
  evidence.artifacts.push(await artifactEvidence(wheel, 'tnl-intelligence wheel'));
  evidence.artifacts.push(await artifactEvidence(source, 'tnl-intelligence sdist'));

  const summaries = [];
  for (const [kind, artifact] of [
    ['wheel', wheel],
    ['sdist', source],
  ]) {
    const directory = join(temporaryRoot, `python-${kind}`);
    run(buildPython, ['-m', 'venv', directory], { timeout: 120_000 });
    const python = venvPython(directory);
    run(python, ['-m', 'pip', 'install', '--disable-pip-version-check', artifact], {
      timeout: 180_000,
    });
    const script = join(directory, 'smoke.py');
    await cp(join(root, 'test/consumers/python/smoke.py'), script);
    const result = run(python, [script], {
      cwd: directory,
      env: { ...process.env, TNL_BASE_URL: mock.baseUrl, TNL_API_KEY: TEST_API_KEY },
      timeout: 120_000,
    });
    const summary = JSON.parse(result.stdout.trim().split('\n').at(-1));
    if (!summary.ok) throw new Error(`Python ${kind} consumer did not report success`);
    summaries.push({ kind, checks: summary.checks });
  }
  return { consumers: summaries };
}

async function containerStage() {
  const suffix = `${process.pid}-${Date.now()}`;
  const network = `tnl-harness-${suffix}`;
  const mockName = `tnl-mock-${suffix}`;
  const mcpName = `tnl-mcp-${suffix}`;
  const mockImage = `tnl-mock-harness:${suffix}`;
  const mcpImage = `tnl-intelligence-harness:${suffix}`;
  evidence.environment.docker = commandOutput('docker', [
    'version',
    '--format',
    '{{.Server.Version}}',
  ]);

  run('docker', ['build', '-f', 'test/mock-tnl/Dockerfile', '-t', mockImage, '.'], {
    timeout: 300_000,
  });
  cleanupTasks.push(async () => allowFailure('docker', ['image', 'rm', '-f', mockImage]));
  run('docker', ['build', '-t', mcpImage, '.'], { timeout: 300_000 });
  cleanupTasks.push(async () => allowFailure('docker', ['image', 'rm', '-f', mcpImage]));
  run('docker', ['network', 'create', network]);
  cleanupTasks.push(async () => allowFailure('docker', ['network', 'rm', network]));
  run('docker', [
    'run',
    '-d',
    '--network',
    network,
    '--name',
    mockName,
    '--network-alias',
    'mock',
    mockImage,
  ]);
  cleanupTasks.push(async () => allowFailure('docker', ['rm', '-f', mockName]));
  run(
    'docker',
    [
      'run',
      '-d',
      '--network',
      network,
      '--name',
      mcpName,
      '-e',
      'TNL_API_KEY',
      '-e',
      'TNL_BASE_URL=http://mock:8080',
      '-p',
      '127.0.0.1::7317',
      mcpImage,
    ],
    { env: { ...process.env, TNL_API_KEY: TEST_API_KEY } },
  );
  cleanupTasks.push(async () => allowFailure('docker', ['rm', '-f', mcpName]));

  const configuredUser = commandOutput('docker', [
    'inspect',
    '--format',
    '{{.Config.User}}',
    mcpName,
  ]);
  if (configuredUser !== 'node')
    throw new Error(`Container must run as node, received ${configuredUser}`);
  const mapping = commandOutput('docker', ['port', mcpName, '7317/tcp']);
  const port = Number(mapping.split(':').at(-1));
  if (!Number.isInteger(port)) throw new Error(`Could not parse container port from ${mapping}`);
  const healthUrl = `http://127.0.0.1:${port}/healthz`;
  await waitForHttp(healthUrl, 30_000);
  const unauthorized = await fetch(`http://127.0.0.1:${port}/mcp`, { method: 'POST' });
  if (unauthorized.status !== 401)
    throw new Error('Container MCP did not reject missing credentials');
  const result = run('node', ['mcp-http-smoke.mjs'], {
    cwd: nodeConsumerDirectory,
    env: {
      ...process.env,
      TNL_MCP_URL: `http://127.0.0.1:${port}/mcp`,
      TNL_API_KEY: TEST_API_KEY,
    },
    timeout: 60_000,
  });
  const summary = JSON.parse(result.stdout.trim());
  return { configuredUser, checks: summary.checks };
}

async function inspectionStage() {
  const commonForbiddenEntries = [
    /(^|\/)node_modules\//,
    /(^|\/)test\//,
    /(^|\/)\.env($|\.)/,
    /\.tsbuildinfo$/,
    /\.mypy_cache\//,
    /__pycache__\//,
  ];
  for (const artifact of evidence.artifacts) {
    const entries = archiveEntries(artifact.path);
    const forbiddenEntries = artifact.label.endsWith('sdist')
      ? commonForbiddenEntries
      : [...commonForbiddenEntries, /(^|\/)src\//];
    const unexpected = entries.filter((entry) =>
      forbiddenEntries.some((pattern) => pattern.test(entry)),
    );
    if (unexpected.length > 0) {
      throw new Error(
        `${artifact.label} contains forbidden entries: ${unexpected.slice(0, 5).join(', ')}`,
      );
    }
    artifact.entryCount = entries.length;
  }
  const serialized = JSON.stringify(evidence);
  for (const pattern of [
    /Bearer\s+[A-Za-z0-9._-]{20,}/i,
    /(?:api[_-]?key|secret|token)["'\s:=]+[A-Za-z0-9._-]{20,}/i,
    /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  ]) {
    if (pattern.test(serialized)) throw new Error(`Secret-pattern scan failed for ${pattern}`);
  }
  return { artifactCount: evidence.artifacts.length, secretPatterns: 3 };
}

async function stage(name, action) {
  throwIfAborted();
  stageNumber += 1;
  process.stdout.write(`${stageNumber}. Running: ${name}\n`);
  const startedAt = Date.now();
  const record = { name, status: 'running', startedAt: new Date(startedAt).toISOString() };
  evidence.stages.push(record);
  try {
    record.details = await action();
    throwIfAborted();
    record.status = 'passed';
  } catch (error) {
    record.status = 'failed';
    record.error = safeError(error);
    throw error;
  } finally {
    record.durationMs = Date.now() - startedAt;
  }
  process.stdout.write(`${stageNumber}. Complete: ${name}\n`);
}

function throwIfAborted() {
  if (signalController.signal.aborted) {
    throw signalController.signal.reason instanceof Error
      ? signalController.signal.reason
      : new Error('Integration harness was interrupted');
  }
}

async function cleanup() {
  let cleanupNumber = 0;
  for (const task of cleanupTasks.reverse()) {
    cleanupNumber += 1;
    try {
      await task();
      evidence.cleanup.push({ order: cleanupNumber, status: 'passed' });
    } catch (error) {
      evidence.cleanup.push({ order: cleanupNumber, status: 'failed', error: safeError(error) });
      evidence.status = 'failed';
    }
  }
  if (temporaryRoot) {
    try {
      await access(temporaryRoot);
      evidence.cleanup.push({ status: 'failed', reason: 'temporary root remains' });
      evidence.status = 'failed';
    } catch {
      evidence.cleanup.push({ status: 'passed', reason: 'temporary root removed' });
    }
  }
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || root,
    env: options.env || process.env,
    encoding: 'utf8',
    timeout: options.timeout || 60_000,
    maxBuffer: 50 * 1024 * 1024,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      redact(
        `${command} ${args.join(' ')} failed with ${result.status}\n${result.stdout}\n${result.stderr}`,
      ),
    );
  }
  return { stdout: result.stdout || '', stderr: redact(result.stderr || '') };
}

function allowFailure(command, args) {
  spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 30_000 });
}

function commandOutput(command, args) {
  return redact(execFileSync(command, args, { cwd: root, encoding: 'utf8' }).trim());
}

async function artifactEvidence(path, label, files) {
  const buffer = await readFile(path);
  return {
    label,
    path: relative(path),
    bytes: buffer.length,
    sha256: createHash('sha256').update(buffer).digest('hex'),
    ...(files ? { packedFiles: files } : {}),
  };
}

function archiveEntries(path) {
  if (path.endsWith('.whl')) {
    return commandOutput('unzip', ['-Z1', path]).split('\n').filter(Boolean);
  }
  return commandOutput('tar', ['-tzf', path]).split('\n').filter(Boolean);
}

function validateNewsPage(value, name) {
  if (!value || !Array.isArray(value.data) || typeof value.page !== 'object') {
    throw new Error(`${name} must contain data and page`);
  }
  for (const story of value.data) {
    if (typeof story.id !== 'string' || !story.id)
      throw new Error(`${name} has a story without id`);
  }
  for (const field of ['page', 'page_size', 'offset', 'total_count', 'total_pages']) {
    if (!Number.isInteger(value.page[field]))
      throw new Error(`${name} page.${field} must be integer`);
  }
}

async function existingPython() {
  const candidates = [join(root, '.venv/bin/python'), 'python3'];
  for (const candidate of candidates) {
    try {
      commandOutput(candidate, ['-m', 'build', '--version']);
      return candidate;
    } catch {}
  }
  throw new Error('Python build module is required; install the project dev environment');
}

function requiredMatch(names, pattern) {
  const matches = names.filter((name) => pattern.test(name));
  if (matches.length !== 1)
    throw new Error(`Expected one ${pattern}, received ${matches.join(', ')}`);
  return matches[0];
}

function venvPython(directory) {
  return process.platform === 'win32'
    ? join(directory, 'Scripts', 'python.exe')
    : join(directory, 'bin', 'python');
}

async function waitForHttp(url, timeout) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {}
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 100));
  }
  throw new Error(`Timed out waiting for ${url}`);
}

async function startMockProcess() {
  const child = spawn(process.execPath, ['test/mock-tnl/server.mjs'], {
    cwd: root,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
  child.stderr.on('data', (chunk) => (stderr += chunk.toString()));
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`Mock TNL exited with ${child.exitCode}: ${redact(stderr)}`);
    }
    const line = stdout.split('\n').find((value) => value.trim());
    if (line) {
      const value = JSON.parse(line);
      if (typeof value.baseUrl !== 'string') throw new Error('Mock TNL did not report baseUrl');
      return { baseUrl: value.baseUrl, process: child };
    }
    await new Promise((resolvePromise) => setTimeout(resolvePromise, 20));
  }
  await stopChild(child);
  throw new Error(`Timed out starting mock TNL: ${redact(stderr)}`);
}

async function stopChild(child) {
  if (child.exitCode !== null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolvePromise) => child.once('exit', resolvePromise)),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Child process did not stop after SIGTERM')), 5_000),
    ),
  ]);
}

async function assertPrivate(path) {
  if (process.platform === 'win32') return;
  const mode = (await stat(path)).mode & 0o777;
  if (mode !== 0o600)
    throw new Error(`${relative(path)} must use mode 0600, received ${mode.toString(8)}`);
}

function safeError(error) {
  return {
    name: error instanceof Error ? error.name : 'Error',
    message: redact(error instanceof Error ? error.message : String(error)),
  };
}

function redact(value) {
  return String(value)
    .replaceAll(TEST_API_KEY, '[redacted]')
    .replace(/Bearer\s+[^\s"']+/gi, 'Bearer [redacted]')
    .replace(/(TNL_API_KEY=)[^\s]+/gi, '$1[redacted]');
}

function relative(path) {
  return path.startsWith(root) ? path.slice(root.length + 1) : basename(path);
}
