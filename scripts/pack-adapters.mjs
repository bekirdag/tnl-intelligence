import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactRoot = resolve(root, '.artifacts/tool-07');
await mkdir(artifactRoot, { recursive: true });
const bundles = [
  ['cursor', 'integrations/cursor/tnl-intelligence'],
  ['openai', 'integrations/openai/tnl-intelligence'],
];
const evidence = { schemaVersion: '1.0', adapterVersion: '0.1.0', artifacts: [] };
for (const [host, source] of bundles) {
  const files = await filesBelow(resolve(root, source));
  const tar = Buffer.concat(
    await Promise.all(
      files.map(async (path) => {
        const name = relative(resolve(root, source), path).replaceAll('\\', '/');
        return tarEntry(name, await readFile(path));
      }),
    ),
  );
  const archive = gzipSync(Buffer.concat([tar, Buffer.alloc(1_024)]), { level: 9, mtime: 0 });
  const filename = `tnl-intelligence-${host}-0.1.0.tar.gz`;
  await writeFile(resolve(artifactRoot, filename), archive);
  evidence.artifacts.push({
    host,
    filename,
    bytes: archive.length,
    sha256: createHash('sha256').update(archive).digest('hex'),
    files: files.map((path) => relative(resolve(root, source), path).replaceAll('\\', '/')),
  });
}
await writeFile(
  resolve(artifactRoot, 'bundle-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);

async function filesBelow(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await filesBelow(path)));
    else output.push(path);
  }
  return output.sort();
}

function tarEntry(name, data) {
  if (Buffer.byteLength(name) > 100) throw new Error(`Tar path is too long: ${name}`);
  const header = Buffer.alloc(512);
  field(header, 0, 100, name);
  octal(header, 100, 8, 0o644);
  octal(header, 108, 8, 0);
  octal(header, 116, 8, 0);
  octal(header, 124, 12, data.length);
  octal(header, 136, 12, 0);
  header.fill(0x20, 148, 156);
  header[156] = '0'.charCodeAt(0);
  field(header, 257, 6, 'ustar');
  field(header, 263, 2, '00');
  field(header, 265, 32, 'root');
  field(header, 297, 32, 'root');
  const checksum = header.reduce((sum, value) => sum + value, 0);
  octal(header, 148, 8, checksum);
  return Buffer.concat([header, data, Buffer.alloc((512 - (data.length % 512)) % 512)]);
}

function field(buffer, offset, length, value) {
  buffer.write(value, offset, Math.min(length, Buffer.byteLength(value)), 'utf8');
}

function octal(buffer, offset, length, value) {
  const text = value.toString(8).padStart(length - 1, '0');
  buffer.write(`${text}\0`, offset, length, 'ascii');
}
