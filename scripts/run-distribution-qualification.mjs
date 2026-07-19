#!/usr/bin/env node
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createServer } from 'node:http';
import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { runDoctor, DOCTOR_EXIT } from '../packages/artifacts/dist/index.js';
import { startMockTnl, TEST_API_KEY } from '../test/mock-tnl/server.mjs';

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, '.artifacts/tool-06');
const mock = await startMockTnl();
const temporary = await mkdtemp(resolve(tmpdir(), 'tnl-tool-06-'));
let metadata;

try {
  process.stdout.write('Tool 06: checking generated artifacts...\n');
  await command('npm', ['run', 'distribution:check']);
  await command('npm', ['test', '--workspace', '@theneuralledger/artifacts']);
  process.stdout.write('Tool 06: packing reproducible MCPB...\n');
  await command('npm', ['run', 'distribution:pack']);

  const cleanBundle = resolve(temporary, 'bundle');
  await cp(resolve(artifacts, 'bundle'), cleanBundle, { recursive: true });
  const entrypoint = resolve(cleanBundle, 'server/node_modules/@theneuralledger/mcp/dist/bin.js');
  const doctorOptions = {
    mode: 'local',
    entrypoint,
    apiBaseUrl: mock.baseUrl,
    apiKey: TEST_API_KEY,
    configPath: resolve(root, 'distribution/generated/generic/local.json'),
    integrityPath: resolve(cleanBundle, 'integrity.json'),
    timeoutMs: 10_000,
  };
  const first = await runDoctor(doctorOptions);
  const restarted = await runDoctor(doctorOptions);
  assert.equal(first.ok, true, JSON.stringify(first));
  assert.equal(restarted.ok, true, JSON.stringify(restarted));
  assert.equal(first.checks.find((check) => check.id === 'mcp.local')?.status, 'pass');

  const missing = await runDoctor({ mode: 'local', entrypoint, skipApi: true });
  assert.equal(missing.exitCode, DOCTOR_EXIT.credential);
  assert.doesNotMatch(JSON.stringify(first), new RegExp(TEST_API_KEY));

  const invalidConfig = resolve(temporary, 'invalid.json');
  await writeFile(invalidConfig, '{');
  const invalid = await runDoctor({
    mode: 'local',
    entrypoint,
    configPath: invalidConfig,
    skipApi: true,
  });
  assert.equal(invalid.exitCode, DOCTOR_EXIT.configuration);

  metadata = await startMetadataServer();
  const remote = await runDoctor({ mode: 'remote', remoteUrl: metadata.url });
  assert.equal(remote.ok, true, JSON.stringify(remote));
  assert.equal(remote.checks.find((check) => check.id === 'oauth.metadata')?.status, 'pass');

  const capabilities = JSON.parse(
    await readFile(resolve(root, 'distribution/generated/capabilities.json'), 'utf8'),
  );
  assert.equal(capabilities.generatedFrom, 'runtime-introspection');
  assert.equal(capabilities.tools.length, 8);
  assert.equal(capabilities.resourceTemplates.length, 3);
  assert.equal(capabilities.prompts.length, 2);
  for (const path of [
    'generic/local.json',
    'generic/remote.json',
    'vscode/local.mcp.json',
    'vscode/remote.mcp.json',
    'cursor/local.mcp.json',
    'cursor/remote.mcp.json',
    'compatibility-matrix.json',
    'artifact-index.json',
  ]) {
    const text = await readFile(resolve(root, 'distribution/generated', path), 'utf8');
    JSON.parse(text);
    assert.doesNotMatch(text, /\/Users\//);
    assert.doesNotMatch(text, /BEGIN PRIVATE KEY/);
  }

  const bundleEvidence = JSON.parse(
    await readFile(resolve(artifacts, 'bundle-evidence.json'), 'utf8'),
  );
  assert.equal(bundleEvidence.archive.reproducible, true);
  assert.equal(bundleEvidence.registryRequired, false);
  assert.equal(bundleEvidence.archive.npmAudit.high ?? 0, 0);
  assert.equal(bundleEvidence.archive.npmAudit.critical ?? 0, 0);

  process.stdout.write('Tool 06: clean-profile doctor checks passed.\n');
  const evidence = {
    schemaVersion: '1.0',
    qualifiedAt: new Date().toISOString(),
    capabilities: {
      tools: capabilities.tools.length,
      resourceTemplates: capabilities.resourceTemplates.length,
      prompts: capabilities.prompts.length,
    },
    doctor: {
      firstRun: first,
      restartRun: restarted,
      missingCredentialExit: missing.exitCode,
      invalidConfigurationExit: invalid.exitCode,
      remoteMetadata: remote,
    },
    bundle: bundleEvidence,
    container: { skipped: true, qualification: 'run-distribution-container-qualification.sh' },
    cleanProfileRemoved: true,
  };
  await writeFile(resolve(artifacts, 'evidence.json'), `${JSON.stringify(evidence, null, 2)}\n`);
  process.stdout.write('Tool 06 qualification passed.\n');
} finally {
  await metadata?.close();
  await mock.close();
  await rm(temporary, { recursive: true, force: true });
}

async function startMetadataServer() {
  const server = createServer((request, response) => {
    if (request.url === '/.well-known/oauth-protected-resource') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          resource: 'http://127.0.0.1/mcp',
          authorization_servers: ['https://identity.example'],
          scopes_supported: ['tnl:read', 'tnl:research'],
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  const address = server.address();
  if (!address || typeof address === 'string') throw new TypeError('metadata server did not bind');
  return {
    url: `http://127.0.0.1:${address.port}/mcp`,
    close: () => new Promise((accept) => server.close(accept)),
  };
}

async function command(file, args) {
  const result = await execFile(file, args, {
    cwd: root,
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
  });
  return result.stdout;
}
