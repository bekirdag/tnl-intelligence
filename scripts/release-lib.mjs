import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, rename, stat, writeFile } from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export const releaseArtifactDirectory = resolve(root, '.artifacts', 'tool-10');

export function run(file, args, options = {}) {
  return execFileSync(file, args, {
    cwd: options.cwd ?? root,
    encoding: 'utf8',
    maxBuffer: options.maxBuffer ?? 128 * 1024 * 1024,
    env: { ...process.env, ...options.env },
    stdio: options.stdio ?? ['ignore', 'pipe', 'pipe'],
  }).trim();
}

export async function readJson(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

export async function writeJsonAtomic(path, value) {
  const absolute = resolve(root, path);
  await mkdir(dirname(absolute), { recursive: true, mode: 0o700 });
  const temporary = `${absolute}.${process.pid}.tmp`;
  await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  await rename(temporary, absolute);
}

export function sha256(value) {
  return createHash('sha256').update(value).digest('hex');
}

export async function fileRecord(path, extra = {}) {
  const absolute = resolve(root, path);
  const [body, details] = await Promise.all([readFile(absolute), stat(absolute)]);
  return {
    path: relative(root, absolute).replaceAll('\\', '/'),
    sha256: sha256(body),
    size: details.size,
    ...extra,
  };
}

export async function walkFiles(path) {
  const absolute = resolve(root, path);
  const output = [];
  for (const entry of await readdir(absolute, { withFileTypes: true })) {
    const child = resolve(absolute, entry.name);
    if (entry.isDirectory()) output.push(...(await walkFiles(child)));
    else if (entry.isFile()) output.push(relative(root, child).replaceAll('\\', '/'));
  }
  return output.sort();
}

export async function sourceDigest() {
  const paths = run('git', ['ls-files', '-co', '--exclude-standard', '-z'])
    .split('\0')
    .filter(Boolean)
    .filter(
      (path) =>
        !path.startsWith('.artifacts/') &&
        !path.startsWith('.docdex/') &&
        !path.includes('/dist/') &&
        !path.includes('/__pycache__/'),
    )
    .sort();
  const records = [];
  for (const path of paths) {
    const record = await fileRecord(path);
    records.push(`${record.path}\0${record.size}\0${record.sha256}`);
  }
  return sha256(records.join('\n'));
}

export function classifyArtifact(path) {
  if (/\.(tgz|whl|tar\.gz|zip|mcpb)$/.test(path)) return 'package';
  if (/\.(png|webp)$/.test(path)) return 'browser-evidence';
  if (/benchmark\.json$/.test(path)) return 'benchmark';
  if (/(sbom|provenance|vulnerabilit|license|audit|scan)/i.test(path))
    return 'supply-chain-evidence';
  if (/container|image/i.test(path)) return 'container-evidence';
  if (/evidence\.json$/.test(path)) return 'qualification-evidence';
  if (/bundle/i.test(path)) return 'bundle';
  return 'other';
}

export async function packageInventory() {
  const workspace = await readJson('package.json');
  const packagePaths = [
    ...(await walkFiles('packages')).filter((path) => path.endsWith('/package.json')),
    ...(await walkFiles('integrations')).filter((path) => path.endsWith('/package.json')),
  ];
  const packages = [];
  for (const path of packagePaths) {
    const value = await readJson(path);
    if (value.name && value.version)
      packages.push({ kind: 'npm', name: value.name, version: value.version, path });
  }
  const pyproject = await readFile(resolve(root, 'python/tnl_intelligence/pyproject.toml'), 'utf8');
  const pythonVersion = pyproject.match(/^version\s*=\s*"([^"]+)"/m)?.[1];
  if (!pythonVersion) throw new Error('Unable to resolve Python package version');
  packages.push({
    kind: 'python',
    name: 'tnl-intelligence',
    version: pythonVersion,
    path: 'python/tnl_intelligence/pyproject.toml',
  });
  packages.push({
    kind: 'mcp-bundle',
    name: 'tnl-intelligence-mcpb',
    version: workspace.version,
    path: 'distribution/mcp-server.json',
  });
  packages.push({
    kind: 'container',
    name: 'tnl-intelligence',
    version: workspace.version,
    path: 'Dockerfile',
  });
  return packages.sort((left, right) => left.name.localeCompare(right.name));
}

export async function contractInventory() {
  const paths = [
    'openapi/tnl.openapi.json',
    'schemas/webhooks/v1/envelope.schema.json',
    'schemas/research/v1/task.schema.json',
    'schemas/research/v1/result.schema.json',
    'schemas/adapters/adapter-manifest.schema.json',
    'schemas/connectors/connector-manifest.schema.json',
    'schemas/quant/dataset-manifest.schema.json',
    'distribution/release/compatibility-matrix.json',
  ];
  return Promise.all(paths.map((path) => fileRecord(path)));
}

export async function fixtureInventory() {
  const paths = await walkFiles('test/fixtures');
  paths.push(
    ...(await walkFiles('python/tnl_intelligence/src/tnl_intelligence/quant/example_assets/data')),
  );
  return Promise.all(paths.sort().map((path) => fileRecord(path)));
}

export async function artifactInventory() {
  const paths = [];
  for (let tool = 1; tool <= 9; tool += 1) {
    const directory = `.artifacts/tool-${String(tool).padStart(2, '0')}`;
    try {
      paths.push(...(await walkFiles(directory)));
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  const releaseFiles = paths.filter(
    (path) => !path.includes('/bundle/') && !path.includes('/unpacked/'),
  );
  return Promise.all(
    releaseFiles.map((path) =>
      fileRecord(path, {
        tool: path.match(/\.artifacts\/(tool-\d{2})\//)?.[1] ?? 'tool-01',
        kind: classifyArtifact(path),
      }),
    ),
  );
}

export function environmentInventory() {
  const python = run(resolve(root, '.venv/bin/python'), ['--version']);
  let docker = 'unavailable';
  try {
    docker = run('docker', ['--version']);
  } catch {}
  return {
    node: process.version,
    npm: run('npm', ['--version']),
    python,
    docker,
    platform: process.platform,
    architecture: process.arch,
  };
}

export function technicalGates(state = 'pending') {
  return [
    'contract',
    'functional',
    'security-privacy',
    'reliability',
    'operations',
    'artifact',
    'documentation',
  ].map((id) => ({ id, state }));
}
