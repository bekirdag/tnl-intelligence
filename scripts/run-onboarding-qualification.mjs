import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { chmod, copyFile, mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactsDirectory = join(root, '.artifacts', 'tool-03');
const temporaryRoot = await mkdtemp(join(tmpdir(), 'tnl-onboarding-'));
const port = await freePort();
const baseUrl = `http://127.0.0.1:${port}`;
const startedAt = Date.now();
const stages = [];
let server;

try {
  await stage('build workspace and start static onboarding service', async () => {
    command('npm', ['run', 'build'], root);
    server = spawn('node', ['packages/onboarding/dist/bin.js'], {
      cwd: root,
      env: {
        ...process.env,
        NODE_ENV: 'development',
        TNL_ONBOARDING_PORT: String(port),
        TNL_OPENAPI_PATH: join(root, 'openapi', 'tnl.openapi.json'),
      },
      stdio: ['ignore', 'ignore', 'pipe'],
    });
    await waitForHealth(`${baseUrl}/healthz`, server);
  });

  await stage('execute curl and generated Postman sample requests', async () => {
    const curl = command(
      'curl',
      ['--fail', '--silent', '--show-error', `${baseUrl}/v1/sample/news?page_size=2`],
      root,
    );
    const page = JSON.parse(curl.stdout);
    assert.deepEqual(
      page.data.map((story) => story.id),
      ['sample-story-1', 'sample-story-2'],
    );
    const collection = JSON.parse(
      await readFile(join(root, 'packages/onboarding/public/postman/collection.json'), 'utf8'),
    );
    for (const item of collection.item.find((folder) => folder.name === 'Static sample').item) {
      const url = item.request.url.raw.replace('{{sample_base_url}}', baseUrl);
      const response = await fetch(url);
      assert.equal(response.status, 200, item.name);
      assert.equal(response.headers.get('x-tnl-data-mode'), 'static-sample', item.name);
    }
  });

  await stage('install local npm tarballs and run SDK, CLI, and MCP quick starts', async () => {
    const packageDirectory = join(temporaryRoot, 'npm-packages');
    const consumerDirectory = join(temporaryRoot, 'node-consumer');
    await mkdir(packageDirectory, { recursive: true });
    await mkdir(consumerDirectory, { recursive: true });
    const tarballs = {};
    for (const workspace of [
      '@theneuralledger/sdk',
      '@theneuralledger/research',
      '@theneuralledger/mcp',
      '@theneuralledger/cli',
    ]) {
      const result = command(
        'npm',
        ['pack', '--json', '--workspace', workspace, '--pack-destination', packageDirectory],
        root,
      );
      tarballs[workspace] = join(packageDirectory, JSON.parse(result.stdout)[0].filename);
    }
    await writeFile(
      join(consumerDirectory, 'package.json'),
      `${JSON.stringify({
        name: 'tnl-onboarding-clean-consumer',
        private: true,
        type: 'module',
        dependencies: Object.fromEntries(
          Object.entries(tarballs).map(([name, path]) => [name, `file:${path}`]),
        ),
      })}\n`,
    );
    command('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], consumerDirectory);
    await copyFile(
      join(root, 'examples/onboarding/typescript.mjs'),
      join(consumerDirectory, 'typescript.mjs'),
    );
    const environment = {
      ...process.env,
      TNL_BASE_URL: baseUrl,
      TNL_API_KEY: 'sample-not-a-secret',
    };
    const sdk = command('node', ['typescript.mjs'], consumerDirectory, environment);
    assert.match(sdk.stdout, /sample-story-1/);
    const cli = command(
      join(consumerDirectory, 'node_modules', '.bin', 'tnl'),
      ['latest', '--limit', '2', '--json'],
      consumerDirectory,
      environment,
    );
    assert.equal(JSON.parse(cli.stdout).data[0].id, 'sample-story-1');
    await writeFile(join(consumerDirectory, 'mcp.mjs'), mcpConsumerSource());
    const mcp = command('node', ['mcp.mjs'], consumerDirectory, environment);
    assert.match(mcp.stdout, /sample-story-1/);
  });

  await stage('build and install a local Python wheel quick start', async () => {
    const pythonProject = join(root, 'python', 'tnl_intelligence');
    const buildPython = existsSync(join(root, '.venv', 'bin', 'python'))
      ? join(root, '.venv', 'bin', 'python')
      : 'python3';
    command(buildPython, ['-m', 'build'], pythonProject);
    const distribution = JSON.parse(
      command('python3', ['-c', pythonWheelDiscovery()], pythonProject).stdout,
    ).wheel;
    const environmentDirectory = join(temporaryRoot, 'python-consumer');
    command('python3', ['-m', 'venv', environmentDirectory], root);
    const python = join(environmentDirectory, 'bin', 'python');
    command(python, ['-m', 'pip', 'install', '--disable-pip-version-check', distribution], root);
    const example = join(root, 'examples', 'onboarding', 'python.py');
    const result = command(python, [example], root, {
      ...process.env,
      TNL_BASE_URL: baseUrl,
      TNL_API_KEY: 'sample-not-a-secret',
    });
    assert.match(result.stdout, /sample-story-1/);
  });

  await stage('scan generated and browser assets for persisted secrets', async () => {
    const paths = [
      'packages/onboarding/public/app.js',
      'packages/onboarding/public/postman/collection.json',
      'packages/onboarding/public/postman/environment.json',
      'docs/developer/quick-starts.md',
    ];
    const contents = await Promise.all(paths.map((path) => readFile(join(root, path), 'utf8')));
    const combined = contents.join('\n');
    assert.doesNotMatch(combined, /localStorage|sessionStorage|indexedDB/);
    assert.doesNotMatch(combined, /tnl_(live|prod)_[A-Za-z0-9_-]{12,}/);
    const environment = JSON.parse(contents[2]);
    assert.equal(environment.values.find((value) => value.key === 'tnl_api_key').value, '');
  });

  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await waitForExit(server);
    server = undefined;
  }
  await rm(temporaryRoot, { recursive: true, force: true });
  await mkdir(artifactsDirectory, { recursive: true });
  const evidencePath = join(artifactsDirectory, 'evidence.json');
  await writeFile(
    evidencePath,
    `${JSON.stringify(
      {
        tool: '03-developer-onboarding-sample-access',
        status: 'passed',
        completedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        sampleBaseUrl: 'loopback-dynamic-port',
        stages,
        cleanup: { temporaryRootRemoved: true, serverStopped: true },
      },
      null,
      2,
    )}\n`,
    { mode: 0o600 },
  );
  await chmod(evidencePath, 0o600);
  process.stdout.write(`Tool 03 qualification passed: ${evidencePath}\n`);
} finally {
  if (server && server.exitCode === null) {
    server.kill('SIGTERM');
    await waitForExit(server);
  }
  await rm(temporaryRoot, { recursive: true, force: true });
}

async function stage(name, action) {
  const began = Date.now();
  process.stdout.write(`${stages.length + 1}. Running: ${name}\n`);
  await action();
  stages.push({ name, status: 'passed', durationMs: Date.now() - began });
  process.stdout.write(`${stages.length}. Complete: ${name}\n`);
}

function command(executable, args, cwd, env = process.env) {
  const result = spawnSync(executable, args, {
    cwd,
    env,
    encoding: 'utf8',
    timeout: 120_000,
    maxBuffer: 20 * 1_024 * 1_024,
  });
  assert.equal(result.status, 0, `${executable} ${args.join(' ')}\n${result.stderr}`);
  return result;
}

async function freePort() {
  const socket = createServer();
  await new Promise((resolvePromise, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolvePromise);
  });
  const address = socket.address();
  assert.ok(address && typeof address !== 'string');
  await new Promise((resolvePromise) => socket.close(resolvePromise));
  return address.port;
}

async function waitForHealth(url, child) {
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error(`Onboarding server exited with ${child.exitCode}`);
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

function mcpConsumerSource() {
  return `import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
const client = new Client({ name: 'onboarding-qualification', version: '1' });
const transport = new StdioClientTransport({
  command: './node_modules/.bin/tnl-mcp',
  args: ['stdio'],
  env: { ...process.env },
  stderr: 'pipe',
});
await client.connect(transport);
try {
  const result = await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 2 } });
  assert.equal(result.structuredContent.data.data[0].id, 'sample-story-1');
  console.log(JSON.stringify({ id: result.structuredContent.data.data[0].id }));
} finally { await client.close(); }
`;
}

function pythonWheelDiscovery() {
  return `import glob, json, os
paths = glob.glob(os.path.join('dist', '*.whl'))
print(json.dumps({'wheel': os.path.abspath(sorted(paths)[-1])}))`;
}
