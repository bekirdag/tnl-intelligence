export interface DistributionManifest {
  schemaVersion: '1.0';
  generatorVersion: string;
  product: {
    name: string;
    displayName: string;
    description: string;
    version: string;
    license: string;
    package: string;
    mcpName: string;
  };
  runtime: {
    node: string;
    mcpProtocol: string;
    packageEntry: string;
    binary: string;
  };
  transports: {
    local: {
      type: 'stdio';
      command: string;
      requiredEnvironment: readonly EnvironmentDeclaration[];
      optionalEnvironment: readonly EnvironmentDeclaration[];
    };
    remote: {
      type: 'http';
      url: string;
      oauthMetadataUrl: string;
      scopes: readonly string[];
    };
  };
  clients: Readonly<Record<string, { enabled: boolean; versionPolicy: string }>>;
  platforms: {
    operatingSystems: readonly ('darwin' | 'linux' | 'win32')[];
    architectures: readonly ('x64' | 'arm64')[];
    containerPlatforms: readonly string[];
  };
  links: {
    homepage: string;
    documentation: string;
    privacy: string;
    support: string;
    changelog: string;
    source: string;
  };
  artifacts: readonly ArtifactDeclaration[];
  limits: {
    bundleBytes: number;
    imageBytes: number;
  };
}

export interface EnvironmentDeclaration {
  name: string;
  description: string;
  secret: boolean;
  required: boolean;
  default?: string;
}

export interface ArtifactDeclaration {
  path: string;
  kind: string;
  host: string;
}

export interface CapabilityTool {
  name: string;
  title?: string;
  description?: string;
  annotations?: Readonly<Record<string, unknown>>;
}

export interface CapabilityItem {
  name: string;
  title?: string;
  description?: string;
  uri?: string;
  uriTemplate?: string;
}

export interface CapabilityInventory {
  generatedFrom: 'runtime-introspection';
  protocolVersion: string;
  server: { name: string; version: string };
  tools: readonly CapabilityTool[];
  resources: readonly CapabilityItem[];
  resourceTemplates: readonly CapabilityItem[];
  prompts: readonly CapabilityItem[];
}

export function assertDistributionManifest(value: unknown): asserts value is DistributionManifest {
  if (!isRecord(value)) throw new TypeError('Distribution manifest must be an object');
  if (value.schemaVersion !== '1.0') throw new TypeError('schemaVersion must be 1.0');
  for (const key of [
    'generatorVersion',
    'product',
    'runtime',
    'transports',
    'clients',
    'platforms',
    'links',
    'artifacts',
    'limits',
  ]) {
    if (!(key in value)) throw new TypeError(`Distribution manifest is missing ${key}`);
  }
  if (!isRecord(value.product) || typeof value.product.version !== 'string')
    throw new TypeError('product.version is required');
  if (!isRecord(value.runtime) || typeof value.runtime.mcpProtocol !== 'string')
    throw new TypeError('runtime.mcpProtocol is required');
  if (
    !isRecord(value.transports) ||
    !isRecord(value.transports.local) ||
    !isRecord(value.transports.remote)
  )
    throw new TypeError('local and remote transports are required');
  if (value.transports.local.type !== 'stdio' || value.transports.remote.type !== 'http')
    throw new TypeError('Unsupported transport declaration');
  for (const raw of [value.transports.remote.url, value.transports.remote.oauthMetadataUrl]) {
    const url = new URL(String(raw));
    if (url.protocol !== 'https:') throw new TypeError('Remote distribution URLs must use HTTPS');
    if (url.username || url.password)
      throw new TypeError('Remote distribution URLs cannot contain credentials');
  }
  if (!Array.isArray(value.artifacts) || value.artifacts.length === 0)
    throw new TypeError('At least one artifact declaration is required');
  const paths = new Set<string>();
  for (const artifact of value.artifacts) {
    if (!isRecord(artifact) || typeof artifact.path !== 'string')
      throw new TypeError('Artifact paths must be strings');
    if (
      artifact.path.startsWith('/') ||
      artifact.path.includes('..') ||
      artifact.path.includes('\\')
    )
      throw new TypeError(`Artifact path must be repository-relative: ${artifact.path}`);
    if (paths.has(artifact.path)) throw new TypeError(`Duplicate artifact path: ${artifact.path}`);
    paths.add(artifact.path);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
