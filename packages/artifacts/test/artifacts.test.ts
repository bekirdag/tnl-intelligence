import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, describe, it } from 'node:test';
import {
  DOCTOR_EXIT,
  renderDistributionArtifacts,
  runDoctor,
  type CapabilityInventory,
  type DistributionManifest,
} from '../src/index.js';

const cleanup: Array<() => Promise<void>> = [];

afterEach(async () => {
  await Promise.allSettled(cleanup.splice(0).map((item) => item()));
});

describe('distribution generator', () => {
  it('renders deterministic secret-safe host artifacts from runtime capabilities', () => {
    const outputs = renderDistributionArtifacts(manifest(), capabilities());
    assert.equal(outputs.size, 14);
    assert.deepEqual(
      JSON.parse(required(outputs, 'distribution/generated/vscode/local.mcp.json')),
      {
        inputs: [
          {
            type: 'promptString',
            id: 'tnl-api-key',
            description: 'TNL developer API key',
            password: true,
          },
        ],
        servers: {
          tnlIntelligence: {
            type: 'stdio',
            command: 'tnl-mcp',
            env: { TNL_API_KEY: '${input:tnl-api-key}' },
          },
        },
      },
    );
    const all = [...outputs.values()].join('\n');
    assert.doesNotMatch(all, /\/Users\//);
    assert.doesNotMatch(all, /BEGIN PRIVATE KEY/);
    assert.match(
      required(outputs, 'distribution/generated/mcpb/manifest.json'),
      /"sensitive": true/,
    );
  });

  it('fails closed on version, protocol, and annotation drift', () => {
    assert.throws(
      () =>
        renderDistributionArtifacts({ ...manifest(), generatorVersion: '2.0.0' }, capabilities()),
      /Generator version drift/,
    );
    assert.throws(
      () =>
        renderDistributionArtifacts(manifest(), {
          ...capabilities(),
          tools: [{ name: 'unsafe', annotations: { readOnlyHint: false } }],
        }),
      /read-only annotations/,
    );
  });
});

describe('connection doctor', () => {
  it('validates config and integrity without printing credentials', async () => {
    const directory = await temporaryDirectory();
    const config = resolve(directory, 'mcp.json');
    const target = resolve(directory, 'target.txt');
    const integrity = resolve(directory, 'integrity.json');
    await writeFile(config, '{"mcpServers":{}}\n');
    await writeFile(target, 'fixture\n');
    await writeFile(
      integrity,
      JSON.stringify({
        files: [
          {
            path: 'target.txt',
            sha256: createHash('sha256').update('fixture\n').digest('hex'),
          },
        ],
      }),
    );
    const report = await runDoctor({
      mode: 'remote',
      remoteUrl: await metadataServer(),
      configPath: config,
      integrityPath: integrity,
    });
    assert.equal(report.ok, true);
    assert.equal(report.redaction.credentialsPrinted, false);
    assert.equal(report.checks.find((item) => item.id === 'integrity')?.status, 'pass');
  });

  it('uses stable exit classes for missing credentials and invalid integrity', async () => {
    const directory = await temporaryDirectory();
    const entrypoint = resolve(directory, 'bin.js');
    await writeFile(entrypoint, '');
    const missing = await runDoctor({ mode: 'local', entrypoint });
    assert.equal(missing.exitCode, DOCTOR_EXIT.credential);

    const integrity = resolve(directory, 'integrity.json');
    await writeFile(resolve(directory, 'target.txt'), 'changed');
    await writeFile(
      integrity,
      JSON.stringify({ files: [{ path: 'target.txt', sha256: '0'.repeat(64) }] }),
    );
    const invalid = await runDoctor({
      mode: 'remote',
      remoteUrl: await metadataServer(),
      integrityPath: integrity,
    });
    assert.equal(invalid.exitCode, DOCTOR_EXIT.integrity);
  });
});

function manifest(): DistributionManifest {
  const artifactPaths = [
    'capabilities.json',
    'generic/local.json',
    'generic/remote.json',
    'generic/docker.json',
    'generic/published-placeholder.json',
    'vscode/local.mcp.json',
    'vscode/remote.mcp.json',
    'cursor/local.mcp.json',
    'cursor/remote.mcp.json',
    'docker/catalog.json',
    'mcpb/manifest.json',
    'compatibility-matrix.json',
    'docs/INSTALL.md',
    'artifact-index.json',
  ].map((path) => `distribution/generated/${path}`);
  return {
    schemaVersion: '1.0',
    generatorVersion: '1.0.0',
    product: {
      name: 'tnl-intelligence',
      displayName: 'TNL Intelligence',
      description: 'Read-only intelligence.',
      version: '0.1.0',
      license: 'MIT',
      package: '@theneuralledger/mcp',
      mcpName: 'com.theneuralledger/intelligence',
    },
    runtime: {
      node: '>=20.10',
      mcpProtocol: '2025-11-25',
      packageEntry: 'dist/bin.js',
      binary: 'tnl-mcp',
    },
    transports: {
      local: {
        type: 'stdio',
        command: 'tnl-mcp',
        requiredEnvironment: [],
        optionalEnvironment: [],
      },
      remote: {
        type: 'http',
        url: 'https://mcp.theneuralledger.com/mcp',
        oauthMetadataUrl: 'https://mcp.theneuralledger.com/.well-known/oauth-protected-resource',
        scopes: ['tnl:read'],
      },
    },
    clients: { generic: { enabled: true, versionPolicy: 'current' } },
    platforms: {
      operatingSystems: ['darwin', 'linux', 'win32'],
      architectures: ['x64', 'arm64'],
      containerPlatforms: ['linux/amd64', 'linux/arm64'],
    },
    links: {
      homepage: 'https://theneuralledger.com',
      documentation: 'https://github.com/bekirdag/tnl-intelligence',
      privacy: 'https://theneuralledger.com/privacy',
      support: 'https://github.com/bekirdag/tnl-intelligence/issues',
      changelog: 'https://github.com/bekirdag/tnl-intelligence/blob/main/CHANGELOG.md',
      source: 'https://github.com/bekirdag/tnl-intelligence',
    },
    artifacts: artifactPaths.map((path) => ({ path, kind: 'fixture', host: 'fixture' })),
    limits: { bundleBytes: 1, imageBytes: 1 },
  };
}

function capabilities(): CapabilityInventory {
  return {
    generatedFrom: 'runtime-introspection',
    protocolVersion: '2025-11-25',
    server: { name: 'tnl-intelligence', version: '0.1.0' },
    tools: [
      {
        name: 'tnl_latest_news',
        description: 'Latest news',
        annotations: { readOnlyHint: true, destructiveHint: false },
      },
    ],
    resources: [],
    resourceTemplates: [{ name: 'tnl-story', uriTemplate: 'tnl://story/{id}' }],
    prompts: [{ name: 'tnl_daily_risk_review' }],
  };
}

function required(outputs: ReadonlyMap<string, string>, path: string): string {
  const value = outputs.get(path);
  if (!value) throw new TypeError(`Missing ${path}`);
  return value;
}

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(resolve(tmpdir(), 'tnl-artifacts-'));
  cleanup.push(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function metadataServer(): Promise<string> {
  const server = createServer((request, response) => {
    if (request.url === '/.well-known/oauth-protected-resource') {
      response.setHeader('content-type', 'application/json');
      response.end(
        JSON.stringify({
          resource: 'http://127.0.0.1/mcp',
          authorization_servers: ['https://identity.example'],
          scopes_supported: ['tnl:read'],
        }),
      );
      return;
    }
    response.statusCode = 404;
    response.end();
  });
  await new Promise<void>((accept, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', accept);
  });
  cleanup.push(() => close(server));
  const address = server.address();
  if (!address || typeof address === 'string') throw new TypeError('server did not bind');
  return `http://127.0.0.1:${address.port}/mcp`;
}

async function close(server: Server): Promise<void> {
  await new Promise<void>((accept) => server.close(() => accept()));
}
