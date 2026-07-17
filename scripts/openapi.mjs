import { execFileSync } from 'node:child_process';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import process from 'node:process';

const root = resolve(import.meta.dirname, '..');
const snapshotPath = resolve(root, 'openapi/tnl.openapi.json');
const generatedPath = resolve(root, 'packages/sdk/src/generated/openapi.ts');
const command = process.argv[2] || 'generate';
const sourceUrl = process.env.TNL_OPENAPI_URL || 'https://theneuralledger.com/v1/openapi.json';

if (!['sync', 'generate', 'check'].includes(command)) {
  throw new Error('Usage: node scripts/openapi.mjs <sync|generate|check>');
}

await mkdir(dirname(snapshotPath), { recursive: true });
await mkdir(dirname(generatedPath), { recursive: true });

if (command === 'sync') {
  const response = await fetch(sourceUrl, {
    headers: { 'user-agent': 'tnl-intelligence-openapi-sync/0.1.0' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    throw new Error(`OpenAPI download failed with HTTP ${response.status}`);
  }
  const document = await response.json();
  if (document?.openapi !== '3.1.0' || !document?.paths?.['/v1/news']) {
    throw new Error('Downloaded document is not the expected TNL OpenAPI contract');
  }
  const temporarySnapshot = `${snapshotPath}.tmp`;
  await writeFile(temporarySnapshot, `${JSON.stringify(document, null, 2)}\n`, { mode: 0o644 });
  await rename(temporarySnapshot, snapshotPath);
}

const temporaryGenerated = `${generatedPath}.tmp`;
const executable = process.platform === 'win32' ? 'npx.cmd' : 'npx';
execFileSync(executable, ['openapi-typescript', snapshotPath, '--output', temporaryGenerated], {
  cwd: root,
  stdio: 'inherit',
});

const generated = await readFile(temporaryGenerated, 'utf8');
if (command === 'check') {
  const current = await readFile(generatedPath, 'utf8').catch(() => '');
  await rm(temporaryGenerated, { force: true });
  if (current !== generated) {
    throw new Error('Generated OpenAPI types are stale. Run npm run openapi:generate.');
  }
} else {
  await rename(temporaryGenerated, generatedPath);
}

console.log(`OpenAPI ${command} complete`);
