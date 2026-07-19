#!/usr/bin/env node
import { createHash } from 'node:crypto';
import {
  chmod,
  copyFile,
  cp,
  mkdir,
  readFile,
  readdir,
  rm,
  stat,
  utimes,
  writeFile,
} from 'node:fs/promises';
import { dirname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import { execFile as execFileCallback } from 'node:child_process';

const execFile = promisify(execFileCallback);
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const out = resolve(root, '.artifacts/tool-06');
const tarballs = resolve(out, 'tarballs');
const bundle = resolve(out, 'bundle');
const server = resolve(bundle, 'server');
const manifest = JSON.parse(await readFile(resolve(root, 'distribution/mcp-server.json'), 'utf8'));
const sourceEpoch =
  Number(
    (
      await execFile('git', ['show', '-s', '--format=%ct', 'HEAD'], {
        cwd: root,
        env: process.env,
      })
    ).stdout.trim(),
  ) * 1_000;

await rm(out, { recursive: true, force: true });
await mkdir(tarballs, { recursive: true });
await mkdir(server, { recursive: true });

const packages = [];
for (const workspace of [
  '@theneuralledger/sdk',
  '@theneuralledger/research',
  '@theneuralledger/mcp',
]) {
  const packed = JSON.parse(
    await command('npm', [
      'pack',
      '--json',
      '--pack-destination',
      tarballs,
      '--workspace',
      workspace,
    ]),
  );
  const filename = packed[0]?.filename;
  if (!filename) throw new TypeError(`npm pack did not return a filename for ${workspace}`);
  packages.push({ workspace, filename, path: resolve(tarballs, filename) });
}

await writeFile(
  resolve(server, 'package.json'),
  `${JSON.stringify({ name: 'tnl-mcp-bundle-runtime', version: manifest.product.version, private: true }, null, 2)}\n`,
);
const relativeTarballs = packages.map((item) => relative(server, item.path));
await command(
  'npm',
  ['install', '--ignore-scripts', '--omit=dev', '--no-audit', '--no-fund', ...relativeTarballs],
  { cwd: server },
);

const auditOutput = await commandAllowFailure('npm', ['audit', '--omit=dev', '--json'], {
  cwd: server,
});
const audit = JSON.parse(auditOutput.stdout || auditOutput.stderr || '{}');
const vulnerabilities = audit.metadata?.vulnerabilities ?? {};
if ((vulnerabilities.high ?? 0) > 0 || (vulnerabilities.critical ?? 0) > 0)
  throw new TypeError(
    'Bundle production dependency audit contains high or critical vulnerabilities',
  );
const sbom = sanitizeSbom(
  JSON.parse(
    await command('npm', ['sbom', '--omit=dev', '--sbom-format', 'cyclonedx'], {
      cwd: server,
    }),
  ),
);

await stripSourceMaps(server);
await pruneBundleJunk(server);
await writeFile(resolve(bundle, 'SBOM.cdx.json'), `${JSON.stringify(sbom, null, 2)}\n`);
await writeFile(
  resolve(bundle, 'THIRD_PARTY_NOTICES.json'),
  `${JSON.stringify(await thirdPartyNotices(resolve(server, 'package-lock.json')), null, 2)}\n`,
);
await writeFile(
  resolve(server, 'package.json'),
  `${JSON.stringify(
    {
      name: 'tnl-mcp-bundle-runtime',
      version: manifest.product.version,
      private: true,
      type: 'module',
      dependencies: Object.fromEntries(
        packages.map((item) => [item.workspace, manifest.product.version]),
      ),
    },
    null,
    2,
  )}\n`,
);
await rm(resolve(server, 'package-lock.json'), { force: true });
await copyFile(
  resolve(root, 'distribution/generated/mcpb/manifest.json'),
  resolve(bundle, 'manifest.json'),
);
await copyFile(
  resolve(root, 'packages/research/public/assets/tnl-bot.png'),
  resolve(bundle, 'icon.png'),
);
await copyFile(resolve(root, 'LICENSE'), resolve(bundle, 'LICENSE'));

const integrityFiles = await fileInventory(bundle, new Set(['integrity.json']));
await writeFile(
  resolve(bundle, 'integrity.json'),
  `${JSON.stringify({ schemaVersion: '1.0', algorithm: 'sha256', files: integrityFiles }, null, 2)}\n`,
);
await normalizeTimes(bundle, new Date(sourceEpoch));
await chmod(resolve(bundle, `server/node_modules/${manifest.product.package}/dist/bin.js`), 0o755);
await scanBundle(bundle);

const archive = resolve(out, `tnl-intelligence-${manifest.product.version}.mcpb`);
const archiveRepeat = resolve(out, 'reproducibility-check.mcpb');
await zipBundle(bundle, archive);
await zipBundle(bundle, archiveRepeat);
const archiveHash = await hashFile(archive);
const repeatHash = await hashFile(archiveRepeat);
if (archiveHash !== repeatHash) throw new TypeError('MCPB archive is not reproducible');
await rm(archiveRepeat, { force: true });
await command('unzip', ['-tq', archive]);

const unpacked = resolve(out, 'unpacked');
await mkdir(unpacked, { recursive: true });
await command('unzip', ['-q', archive, '-d', unpacked]);
await scanBundle(unpacked);
const unpackedManifest = JSON.parse(await readFile(resolve(unpacked, 'manifest.json'), 'utf8'));
validateMcpbManifest(unpackedManifest);

const archiveBytes = (await stat(archive)).size;
if (archiveBytes > manifest.limits.bundleBytes)
  throw new TypeError(`MCPB archive exceeds ${manifest.limits.bundleBytes} bytes`);
await writeFile(resolve(out, 'SHA256SUMS'), `${archiveHash}  ${relative(out, archive)}\n`);
const gitStatus = await command('git', ['status', '--porcelain']);
const lockHash = await hashFile(resolve(root, 'package-lock.json'));
const provenance = {
  schemaVersion: '1.0',
  artifact: relative(out, archive),
  sha256: archiveHash,
  bytes: archiveBytes,
  sourceCommit: (await command('git', ['rev-parse', 'HEAD'])).trim(),
  sourceDirty: Boolean(gitStatus.trim()),
  sourceDateEpoch: sourceEpoch,
  lockfileSha256: lockHash,
  generatorVersion: manifest.generatorVersion,
  node: process.version,
  platform: process.platform,
  architecture: process.arch,
  signing: { status: 'not-signed-local', promotionGate: 'approved release environment' },
  reproducible: true,
  npmAudit: vulnerabilities,
};
await writeFile(resolve(out, 'provenance.json'), `${JSON.stringify(provenance, null, 2)}\n`);
await writeFile(
  resolve(out, 'bundle-evidence.json'),
  `${JSON.stringify(
    {
      schemaVersion: '1.0',
      archive: provenance,
      packages: packages.map((item) => ({
        name: item.workspace,
        filename: item.filename,
      })),
      integrityEntries: integrityFiles.length,
      officialFormat: 'MCPB manifest 0.4 ZIP archive',
      registryRequired: false,
    },
    null,
    2,
  )}\n`,
);
process.stdout.write(
  `Packed ${relative(root, archive)} (${archiveBytes} bytes, sha256 ${archiveHash}).\n`,
);

async function command(file, args, options = {}) {
  const result = await execFile(file, args, {
    cwd: options.cwd ?? root,
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, SOURCE_DATE_EPOCH: String(Math.floor(sourceEpoch / 1_000)) },
  });
  return result.stdout;
}

async function commandAllowFailure(file, args, options = {}) {
  try {
    const result = await execFile(file, args, {
      cwd: options.cwd ?? root,
      maxBuffer: 64 * 1024 * 1024,
      env: process.env,
    });
    return { ...result, exitCode: 0 };
  } catch (error) {
    return {
      stdout: typeof error.stdout === 'string' ? error.stdout : '',
      stderr: typeof error.stderr === 'string' ? error.stderr : '',
      exitCode: error.code ?? 1,
    };
  }
}

async function walk(directory) {
  const paths = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...(await walk(path)));
    else if (entry.isFile()) paths.push(path);
  }
  return paths.sort();
}

async function stripSourceMaps(directory) {
  for (const path of await walk(directory)) {
    if (path.endsWith('.map')) await rm(path, { force: true });
  }
}

async function pruneBundleJunk(directory) {
  const removable = new Set(['test', 'tests', '__tests__', 'fixtures', 'coverage', '.github']);
  const pending = [directory];
  while (pending.length) {
    const current = pending.pop();
    for (const entry of await readdir(current, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue;
      const path = resolve(current, entry.name);
      if (removable.has(entry.name)) await rm(path, { recursive: true, force: true });
      else pending.push(path);
    }
  }
}

async function thirdPartyNotices(lockPath) {
  const lock = JSON.parse(await readFile(lockPath, 'utf8'));
  return {
    schemaVersion: '1.0',
    packages: Object.entries(lock.packages ?? {})
      .filter(([path]) => path.includes('node_modules/'))
      .map(([path, value]) => ({
        name: path.slice(path.lastIndexOf('node_modules/') + 'node_modules/'.length),
        version: value.version ?? null,
        license: value.license ?? 'UNKNOWN',
      }))
      .sort((left, right) => left.name.localeCompare(right.name)),
  };
}

async function fileInventory(directory, excluded) {
  const files = [];
  for (const path of await walk(directory)) {
    const local = relative(directory, path).replaceAll('\\', '/');
    if (!excluded.has(local)) files.push({ path: local, sha256: await hashFile(path) });
  }
  return files;
}

async function normalizeTimes(directory, date) {
  for (const path of await walk(directory)) await utimes(path, date, date);
  const directories = [directory];
  for (let index = 0; index < directories.length; index += 1) {
    const current = directories[index];
    for (const entry of await readdir(current, { withFileTypes: true }))
      if (entry.isDirectory()) directories.push(resolve(current, entry.name));
  }
  for (const path of directories.reverse()) await utimes(path, date, date);
}

async function zipBundle(directory, archivePath) {
  await rm(archivePath, { force: true });
  const files = (await walk(directory)).map((path) =>
    relative(directory, path).replaceAll('\\', '/'),
  );
  await command('zip', ['-X', '-q', archivePath, ...files], { cwd: directory });
}

async function scanBundle(directory) {
  const forbidden = [root, '/Users/bekirdag', 'tnl_live_', 'sk-proj-'];
  for (const path of await walk(directory)) {
    const local = relative(directory, path).replaceAll('\\', '/');
    if (
      local.includes('../') ||
      local.endsWith('.map') ||
      local.includes('/test/') ||
      local.includes('/fixtures/')
    )
      throw new TypeError(`Forbidden bundle entry: ${local}`);
    const metadata = await stat(path);
    if (metadata.size > 2_000_000) continue;
    const content = await readFile(path);
    if (content.includes(0)) continue;
    const text = content.toString('utf8');
    if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----\s+[A-Za-z0-9+/=]{64,}/.test(text))
      throw new TypeError(`Bundle entry ${local} contains a private key`);
    for (const value of forbidden)
      if (text.includes(value))
        throw new TypeError(`Bundle entry ${local} contains private material`);
  }
}

function validateMcpbManifest(value) {
  for (const field of ['name', 'version', 'description', 'author', 'server'])
    if (!value[field]) throw new TypeError(`MCPB manifest is missing ${field}`);
  if (value.manifest_version !== '0.4') throw new TypeError('MCPB manifest_version must be 0.4');
  if (
    value.server.type !== 'node' ||
    !value.server.entry_point ||
    !value.server.mcp_config?.command
  )
    throw new TypeError('MCPB Node server configuration is incomplete');
  if (value.user_config?.tnl_api_key?.sensitive !== true)
    throw new TypeError('MCPB TNL API key configuration must be sensitive');
}

function sanitizeSbom(value) {
  if (Array.isArray(value)) return value.map(sanitizeSbom);
  if (!value || typeof value !== 'object') {
    if (typeof value === 'string' && value.startsWith(`file:${root}`))
      return `urn:tnl-local-artifact:${value.slice(value.lastIndexOf('/') + 1)}`;
    return value;
  }
  return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeSbom(item)]));
}

async function hashFile(path) {
  return createHash('sha256')
    .update(await readFile(path))
    .digest('hex');
}
