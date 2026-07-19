import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactRoot = resolve(root, '.artifacts/tool-08');
const packages = [
  { workspace: '@theneuralledger/sdk', role: 'dependency' },
  { workspace: '@theneuralledger/events', role: 'dependency' },
  { workspace: '@theneuralledger/research', role: 'dependency' },
  { workspace: '@theneuralledger/adapters', role: 'dependency' },
  { workspace: '@theneuralledger/connectors', role: 'connector-core' },
  { workspace: 'n8n-nodes-tnl-intelligence', role: 'n8n' },
  { workspace: '@theneuralledger/pipedream-components', role: 'pipedream' },
  { workspace: 'tnl-intelligence-zapier', role: 'zapier' },
];

await rm(artifactRoot, { recursive: true, force: true });
await mkdir(artifactRoot, { recursive: true, mode: 0o700 });

const artifacts = [];
for (const candidate of packages) {
  const packed = JSON.parse(
    execFileSync(
      'npm',
      ['pack', '--json', '--workspace', candidate.workspace, '--pack-destination', artifactRoot],
      { cwd: root, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 },
    ),
  )[0];
  if (!packed?.filename) throw new Error(`npm pack did not return ${candidate.workspace}`);
  const archive = resolve(artifactRoot, packed.filename);
  const contents = listArchive(archive);
  assertArchive(candidate, archive, contents);
  artifacts.push({
    workspace: candidate.workspace,
    role: candidate.role,
    filename: packed.filename,
    bytes: (await readFile(archive)).length,
    sha256: createHash('sha256')
      .update(await readFile(archive))
      .digest('hex'),
    files: contents,
  });
}

const zapierBuild = resolve(root, 'integrations/zapier/build/build.zip');
const zapierArchive = resolve(artifactRoot, 'tnl-intelligence-zapier-0.1.0.zip');
await copyFile(zapierBuild, zapierArchive);
const zip = await readFile(zapierArchive);

const evidence = {
  schemaVersion: '1.0',
  connectorVersion: '0.1.0',
  node: process.version,
  artifacts,
  platformBuilds: [
    {
      role: 'zapier-upload',
      filename: basename(zapierArchive),
      bytes: zip.length,
      sha256: createHash('sha256').update(zip).digest('hex'),
    },
  ],
};
await writeFile(
  resolve(artifactRoot, 'package-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
  { mode: 0o600 },
);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

function listArchive(archive) {
  return execFileSync('tar', ['-tzf', archive], { encoding: 'utf8' })
    .trim()
    .split('\n')
    .filter(Boolean)
    .sort();
}

function assertArchive(candidate, archive, files) {
  if (!files.includes('package/package.json'))
    throw new Error(`${candidate.workspace} archive is missing package.json`);
  const prohibitedPath = files.find((file) =>
    /(?:^|\/)(?:node_modules|\.env|test|tests|build\/source\.zip)(?:\/|$)/.test(file),
  );
  if (prohibitedPath) throw new Error(`${candidate.workspace} includes ${prohibitedPath}`);
  const scan = files
    .filter((file) => /\.(?:js|mjs|cjs|ts|json|md|txt|svg|ya?ml)$/.test(file))
    .map((file) =>
      execFileSync('tar', ['-xOzf', archive, file], {
        encoding: 'utf8',
        maxBuffer: 20 * 1024 * 1024,
      }),
    )
    .join('\n');
  if (/tnl_(?:live|prod)_[A-Za-z0-9_-]{12,}/.test(scan))
    throw new Error(`${candidate.workspace} contains a production-key-shaped value`);
  if (/\/(?:Users|home)\/[A-Za-z0-9._-]+\//.test(scan))
    throw new Error(`${candidate.workspace} contains a private absolute path`);
}
