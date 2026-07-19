import { createHash } from 'node:crypto';
import type { CapabilityInventory, DistributionManifest } from './contracts.js';
import { assertDistributionManifest } from './contracts.js';

export const DISTRIBUTION_GENERATOR_VERSION = '1.0.0';

export function renderDistributionArtifacts(
  manifestValue: unknown,
  capabilities: CapabilityInventory,
): ReadonlyMap<string, string> {
  assertDistributionManifest(manifestValue);
  const manifest = manifestValue;
  assertCapabilityAgreement(manifest, capabilities);

  const outputs = new Map<string, string>();
  const localServer = {
    command: manifest.transports.local.command,
    env: { TNL_API_KEY: '${TNL_API_KEY}' },
  };
  const remoteServer = { type: 'http', url: manifest.transports.remote.url };

  outputs.set('distribution/generated/capabilities.json', json(capabilities));
  outputs.set(
    'distribution/generated/generic/local.json',
    json({ mcpServers: { tnlIntelligence: localServer } }),
  );
  outputs.set(
    'distribution/generated/generic/remote.json',
    json({ mcpServers: { tnlIntelligence: remoteServer } }),
  );
  outputs.set(
    'distribution/generated/generic/docker.json',
    json({
      mcpServers: {
        tnlIntelligence: {
          command: 'docker',
          args: [
            'run',
            '--rm',
            '-i',
            '--read-only',
            '--tmpfs',
            '/tmp:rw,noexec,nosuid,size=16m',
            '-e',
            'TNL_API_KEY',
            '--entrypoint',
            'node',
            `ghcr.io/bekirdag/tnl-intelligence:${manifest.product.version}`,
            'packages/mcp/dist/bin.js',
          ],
        },
      },
    }),
  );
  outputs.set(
    'distribution/generated/generic/published-placeholder.json',
    json({
      publicationRequired: true,
      mcpServers: {
        tnlIntelligence: {
          command: 'npx',
          args: ['--yes', `${manifest.product.package}@${manifest.product.version}`],
          env: { TNL_API_KEY: '${TNL_API_KEY}' },
        },
      },
    }),
  );
  outputs.set('distribution/generated/vscode/local.mcp.json', json(vscodeLocal(manifest)));
  outputs.set(
    'distribution/generated/vscode/remote.mcp.json',
    json({ servers: { tnlIntelligence: remoteServer } }),
  );
  outputs.set(
    'distribution/generated/cursor/local.mcp.json',
    json({ mcpServers: { tnlIntelligence: { command: manifest.transports.local.command } } }),
  );
  outputs.set(
    'distribution/generated/cursor/remote.mcp.json',
    json({ mcpServers: { tnlIntelligence: { url: manifest.transports.remote.url } } }),
  );
  outputs.set(
    'distribution/generated/docker/catalog.json',
    json(dockerCatalog(manifest, capabilities)),
  );
  outputs.set(
    'distribution/generated/mcpb/manifest.json',
    json(mcpbManifest(manifest, capabilities)),
  );
  outputs.set(
    'distribution/generated/compatibility-matrix.json',
    json(compatibilityMatrix(manifest)),
  );
  outputs.set('distribution/generated/docs/INSTALL.md', installationGuide(manifest, capabilities));

  const declared = new Set(manifest.artifacts.map((artifact) => artifact.path));
  for (const path of outputs.keys()) {
    if (!declared.has(path)) throw new TypeError(`Generated artifact is not declared: ${path}`);
  }
  for (const path of declared) {
    if (path.endsWith('/artifact-index.json')) continue;
    if (!outputs.has(path)) throw new TypeError(`Declared artifact is not generated: ${path}`);
  }

  const entries = manifest.artifacts.map((artifact) => {
    const content = outputs.get(artifact.path);
    return {
      ...artifact,
      bytes: content === undefined ? null : Buffer.byteLength(content),
      sha256: content === undefined ? null : sha256(content),
      ...(content === undefined ? { hashReason: 'self-index' } : {}),
    };
  });
  outputs.set(
    'distribution/generated/artifact-index.json',
    json({
      schemaVersion: '1.0',
      generatorVersion: manifest.generatorVersion,
      productVersion: manifest.product.version,
      capabilitySource: capabilities.generatedFrom,
      entries,
    }),
  );
  return outputs;
}

function assertCapabilityAgreement(
  manifest: DistributionManifest,
  capabilities: CapabilityInventory,
): void {
  if (manifest.generatorVersion !== DISTRIBUTION_GENERATOR_VERSION)
    throw new TypeError(`Generator version drift: ${manifest.generatorVersion}`);
  if (manifest.product.version !== capabilities.server.version)
    throw new TypeError(
      `MCP version drift: manifest ${manifest.product.version}, runtime ${capabilities.server.version}`,
    );
  if (manifest.product.name !== capabilities.server.name)
    throw new TypeError(
      `MCP name drift: manifest ${manifest.product.name}, runtime ${capabilities.server.name}`,
    );
  if (manifest.runtime.mcpProtocol !== capabilities.protocolVersion)
    throw new TypeError(
      `MCP protocol drift: manifest ${manifest.runtime.mcpProtocol}, runtime ${capabilities.protocolVersion}`,
    );
  if (capabilities.tools.length === 0) throw new TypeError('Runtime exposes no MCP tools');
  for (const tool of capabilities.tools) {
    if (tool.annotations?.readOnlyHint !== true || tool.annotations.destructiveHint !== false)
      throw new TypeError(`Tool ${tool.name} does not have read-only annotations`);
  }
}

function vscodeLocal(manifest: DistributionManifest): unknown {
  return {
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
        command: manifest.transports.local.command,
        env: { TNL_API_KEY: '${input:tnl-api-key}' },
      },
    },
  };
}

function dockerCatalog(manifest: DistributionManifest, capabilities: CapabilityInventory): unknown {
  return {
    schemaVersion: '1.0',
    name: manifest.product.mcpName,
    displayName: manifest.product.displayName,
    description: manifest.product.description,
    image: `ghcr.io/bekirdag/tnl-intelligence:${manifest.product.version}`,
    platforms: manifest.platforms.containerPlatforms,
    command: ['node', 'packages/mcp/dist/bin.js'],
    transport: 'stdio',
    secrets: [{ name: 'TNL_API_KEY', required: true }],
    tools: capabilities.tools.map((tool) => tool.name),
    source: manifest.links.source,
  };
}

function mcpbManifest(manifest: DistributionManifest, capabilities: CapabilityInventory): unknown {
  return {
    $schema:
      'https://raw.githubusercontent.com/modelcontextprotocol/mcpb/main/schemas/mcpb-manifest-v0.4.schema.json',
    manifest_version: '0.4',
    name: 'tnl-intelligence',
    display_name: manifest.product.displayName,
    version: manifest.product.version,
    description: manifest.product.description,
    long_description:
      'Read-only event, evidence, entity, asset, causal-impact, and Ledger AI intelligence from The Neural Ledger.',
    author: { name: 'The Neural Ledger', url: manifest.links.homepage },
    repository: { type: 'git', url: manifest.links.source },
    homepage: manifest.links.homepage,
    documentation: manifest.links.documentation,
    support: manifest.links.support,
    icon: 'icon.png',
    server: {
      type: 'node',
      entry_point: `server/node_modules/${manifest.product.package}/dist/bin.js`,
      mcp_config: {
        command: 'node',
        args: [`\${__dirname}/server/node_modules/${manifest.product.package}/dist/bin.js`],
        env: {
          TNL_API_KEY: '${user_config.tnl_api_key}',
          TNL_BASE_URL: '${user_config.tnl_base_url}',
        },
      },
    },
    tools: capabilities.tools.map((tool) => ({
      name: tool.name,
      ...(tool.description ? { description: tool.description } : {}),
    })),
    tools_generated: true,
    prompts_generated: true,
    keywords: ['mcp', 'news', 'intelligence', 'research', 'evidence', 'markets'],
    license: manifest.product.license,
    user_config: {
      tnl_api_key: {
        type: 'string',
        title: 'TNL API key',
        description: 'A read-only TNL developer API key.',
        sensitive: true,
        required: true,
      },
      tnl_base_url: {
        type: 'string',
        title: 'TNL API base URL',
        description:
          'The HTTPS TNL API origin. Change only for an approved development environment.',
        default: 'https://theneuralledger.com',
        required: false,
      },
    },
    compatibility: {
      claude_desktop: '>=0.10.0',
      platforms: manifest.platforms.operatingSystems,
      runtimes: { node: manifest.runtime.node },
    },
    privacy_policies: [manifest.links.privacy],
  };
}

function compatibilityMatrix(manifest: DistributionManifest): unknown {
  const profiles = [];
  for (const operatingSystem of manifest.platforms.operatingSystems) {
    for (const architecture of manifest.platforms.architectures) {
      profiles.push({
        operatingSystem,
        architecture,
        localTarball: 'automated-config-and-package-check',
        mcpb: operatingSystem === 'linux' ? 'format-validation' : 'clean-profile-smoke',
        docker: operatingSystem === 'win32' ? 'configuration-only' : 'linux-container-smoke',
        remoteHttp: 'metadata-and-schema-check',
      });
    }
  }
  return {
    schemaVersion: '1.0',
    versionPolicy: Object.fromEntries(
      Object.entries(manifest.clients).map(([name, client]) => [name, client.versionPolicy]),
    ),
    profiles,
    failureModes: [
      'missing-secret',
      'invalid-secret',
      'offline-api',
      'incompatible-runtime',
      'stale-config',
      'invalid-integrity',
    ],
  };
}

function installationGuide(
  manifest: DistributionManifest,
  capabilities: CapabilityInventory,
): string {
  return `<!-- Generated by TNL distribution generator ${manifest.generatorVersion}. Do not edit. -->
# TNL Intelligence MCP Installation

- Version: ${manifest.product.version}
- Runtime: Node ${manifest.runtime.node}
- Packaged capability inventory: ${capabilities.tools.length} tools, ${capabilities.resourceTemplates.length} resource templates, ${capabilities.prompts.length} prompts.

## Local tarball

1. Build and pack the local SDK, research, and MCP workspaces with \`npm run distribution:pack\`.
2. Install the generated MCP tarball in an isolated prefix.
3. Set \`TNL_API_KEY\` in the host's secret store or inherited process environment.
4. Use \`generic/local.json\`, \`vscode/local.mcp.json\`, or \`cursor/local.mcp.json\`.
5. Run \`tnl-doctor --mode local --entrypoint <installed-dist-bin>\` before enabling the server.

## MCP Bundle

Open the generated \`.mcpb\` file in a host that supports MCP Bundle manifest v0.4. The host prompts for the secret API key and stores it using host controls. Validate before installation with \`mcpb verify\` or \`mcpb info\` as appropriate. Local development bundles are intentionally unsigned; release signing happens only in the approved release environment.

## Remote OAuth

Use \`generic/remote.json\`, \`vscode/remote.mcp.json\`, or \`cursor/remote.mcp.json\`. The endpoint is ${manifest.transports.remote.url}. A production host should discover OAuth through ${manifest.transports.remote.oauthMetadataUrl} and request only: ${manifest.transports.remote.scopes.join(', ')}. Do not add a bearer token to committed configuration.

## Verify

1. Initialize MCP.
2. Confirm the tool list matches \`capabilities.json\`.
3. Invoke \`tnl_latest_news\` with a limit of one.
4. Confirm source IDs and timestamps are present in structured output.

## Troubleshoot

Run \`tnl-doctor --json\`. Exit classes distinguish configuration, runtime, integrity, credential/API, MCP, and OAuth/TLS failures without printing secret values.

## Disable and remove

Stop the server in the host, remove only the \`tnlIntelligence\` entry, delete the locally installed bundle or prefix, and revoke the API key or OAuth grant through TNL developer access. The installer and doctor never delete credentials automatically.

- Support: ${manifest.links.support}
- Privacy: ${manifest.links.privacy}
- Changelog: ${manifest.links.changelog}
`;
}

function json(value: unknown): string {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
