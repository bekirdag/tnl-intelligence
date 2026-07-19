import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const commands = [
  ['contracts', 'npm', ['run', 'test:adapters:contracts']],
  ['gateway', 'npm', ['run', 'test', '--workspace', '@theneuralledger/gateway']],
  ['generated-assets', 'npm', ['run', 'adapters:check']],
  ['cursor', 'npm', ['run', 'test:adapter:cursor']],
  ['openai', 'npm', ['run', 'test:adapter:openai']],
  ['security', 'npm', ['run', 'test:adapters:security']],
  ['package', 'npm', ['run', 'adapters:pack:local']],
];
const checks = [];
for (const [id, command, args] of commands) {
  const started = Date.now();
  execFileSync(command, args, { cwd: root, stdio: 'inherit' });
  checks.push({ id, status: 'pass', durationMs: Date.now() - started });
}
const bundle = JSON.parse(
  await readFile(resolve(root, '.artifacts/tool-07/bundle-evidence.json'), 'utf8'),
);
const evidence = {
  schemaVersion: '1.0',
  tool: '07-ai-client-adapters',
  qualifiedAt: new Date().toISOString(),
  sourceRevision: revision(),
  checks,
  bundles: bundle.artifacts,
  automatedCoverage: [
    'shared task/capability/error/render/telemetry contracts',
    'gateway-to-research tenant binding and response validation',
    'Cursor and OpenAI manifest/skill/MCP bundle structure',
    'clean filesystem install, replacement, and removal',
    'secret/private-path scan and read-only safety instructions',
  ],
  externalOwnerGates: [
    { id: 'cursor-client-ui-install', status: 'manual-owner-validation-required' },
    { id: 'chatgpt-developer-mode-app-id', status: 'manual-owner-validation-required' },
    { id: 'live-oauth-account-switch', status: 'staging-account-required' },
    { id: 'marketplace-submission', status: 'not-performed' },
  ],
  evidenceDigest: createHash('sha256')
    .update(JSON.stringify({ checks, artifacts: bundle.artifacts }))
    .digest('hex'),
};
await mkdir(resolve(root, '.artifacts/tool-07'), { recursive: true });
await writeFile(
  resolve(root, '.artifacts/tool-07/qualification-evidence.json'),
  `${JSON.stringify(evidence, null, 2)}\n`,
);
process.stdout.write(`Tool 07 qualification passed (${evidence.evidenceDigest}).\n`);

function revision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'uncommitted';
  }
}
