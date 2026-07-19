import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const artifactRoot = resolve(root, '.artifacts/tool-08');
const temporary = await mkdtemp(join(tmpdir(), 'tnl-tool-08-'));
const checks = [];

try {
  await check('generated-contracts', 'npm', ['run', 'connectors:check']);
  await check('connector-core', 'npm', ['run', 'test:connectors:core']);
  await check('n8n-build', 'npm', ['run', 'build', '--workspace', 'n8n-nodes-tnl-intelligence']);
  await check('n8n-cloud-lint', 'npm', [
    'run',
    'lint',
    '--workspace',
    'n8n-nodes-tnl-intelligence',
  ]);
  await check('n8n-package-tests', 'npm', [
    'run',
    'test',
    '--workspace',
    'n8n-nodes-tnl-intelligence',
  ]);
  await check('n8n-behavior', 'npm', ['run', 'test:connector:n8n']);
  await check('pipedream-schema', 'npm', [
    'run',
    'build',
    '--workspace',
    '@theneuralledger/pipedream-components',
  ]);
  await check('pipedream-package-tests', 'npm', [
    'run',
    'test',
    '--workspace',
    '@theneuralledger/pipedream-components',
  ]);
  await check('pipedream-behavior', 'npm', ['run', 'test:connector:pipedream']);
  await check('zapier-tests', 'npm', ['run', 'test', '--workspace', 'tnl-intelligence-zapier']);
  await check('zapier-validator', 'npm', [
    'run',
    'validate',
    '--workspace',
    'tnl-intelligence-zapier',
  ]);
  await check('zapier-build', 'npm', ['run', 'build', '--workspace', 'tnl-intelligence-zapier']);
  await check('zapier-behavior', 'npm', ['run', 'test:connector:zapier']);
  await check('platform-parity', 'npm', ['run', 'test:connectors:parity']);
  await check('package-candidates', 'npm', ['run', 'connectors:pack:local']);
  await cleanInstall();

  const packageEvidence = JSON.parse(
    await readFile(resolve(artifactRoot, 'package-evidence.json'), 'utf8'),
  );
  const evidence = {
    schemaVersion: '1.0',
    tool: '08-automation-connectors',
    qualifiedAt: new Date().toISOString(),
    sourceRevision: revision(),
    runtime: { node: process.version, npm: npmVersion() },
    checks,
    packages: packageEvidence.artifacts,
    platformBuilds: packageEvidence.platformBuilds,
    automatedCoverage: [
      'six-operation connector core and current generated parity catalog',
      'n8n Cloud dependency, icon, build, lint, action, signature, dedupe, and lifecycle checks',
      'Pipedream component schema, raw-body source, persistent dedupe, and deploy/deactivate checks',
      'Zapier schema, 28 integration checks, isolated build, action, REST Hook, and cleanup checks',
      'canonical base64url webhook secret round trip and exact-byte HMAC verification',
      'clean tarball installation without workspace links, secret-shaped values, or private paths',
    ],
    externalOwnerGates: [
      { id: 'n8n-creator-verification', status: 'not-performed' },
      { id: 'pipedream-app-registration', status: 'not-performed' },
      { id: 'zapier-app-registration', status: 'not-performed' },
      { id: 'hosted-callback-canary', status: 'staging-account-required' },
      { id: 'marketplace-submission', status: 'not-performed' },
    ],
  };
  evidence.evidenceDigest = createHash('sha256')
    .update(
      JSON.stringify({ checks, packages: evidence.packages, builds: evidence.platformBuilds }),
    )
    .digest('hex');
  await mkdir(artifactRoot, { recursive: true, mode: 0o700 });
  await writeFile(
    resolve(artifactRoot, 'qualification-evidence.json'),
    `${JSON.stringify(evidence, null, 2)}\n`,
    { mode: 0o600 },
  );
  process.stdout.write(`Tool 08 qualification passed (${evidence.evidenceDigest}).\n`);
} finally {
  await rm(temporary, { recursive: true, force: true });
}

async function check(id, command, args, cwd = root) {
  const started = Date.now();
  run(command, args, cwd);
  checks.push({ id, status: 'pass', durationMs: Date.now() - started });
}

async function cleanInstall() {
  const started = Date.now();
  const evidence = JSON.parse(
    await readFile(resolve(artifactRoot, 'package-evidence.json'), 'utf8'),
  );
  const archives = evidence.artifacts.map((artifact) => resolve(artifactRoot, artifact.filename));
  await writeFile(
    join(temporary, 'package.json'),
    '{"name":"tnl-tool-08-clean-consumer","private":true,"type":"module"}\n',
  );
  run(
    'npm',
    ['install', '--ignore-scripts', '--legacy-peer-deps', '--no-audit', '--no-fund', ...archives],
    temporary,
  );
  await writeFile(
    join(temporary, 'smoke.mjs'),
    `import { createRequire } from 'node:module';
import { CONNECTOR_OPERATIONS } from '@theneuralledger/connectors';
import pipedreamResultAction from '@theneuralledger/pipedream-components/actions/get-research-result/get-research-result.mjs';
import pipedreamSource from '@theneuralledger/pipedream-components/sources/new-or-updated-intelligence/new-or-updated-intelligence.mjs';
import pipedreamWeeklySource from '@theneuralledger/pipedream-components/sources/weekly-edition/weekly-edition.mjs';
const require = createRequire(import.meta.url);
const n8n = require('n8n-nodes-tnl-intelligence/dist/nodes/shared/runtime.js');
const zapier = require('tnl-intelligence-zapier');
if (CONNECTOR_OPERATIONS.length !== 7) throw new Error('connector catalog mismatch');
if (n8n.TNL_WEBHOOK_EVENT_TYPES.length !== 5) throw new Error('n8n trigger catalog mismatch');
if (!n8n.TNL_WEBHOOK_EVENT_TYPES.includes('digest.weekly_published')) throw new Error('n8n weekly event mismatch');
if (pipedreamResultAction.key !== 'tnl_intelligence-get-research-result') throw new Error('Pipedream result action mismatch');
if (pipedreamSource.key !== 'tnl_intelligence-new-or-updated-intelligence') throw new Error('Pipedream source mismatch');
if (pipedreamWeeklySource.props.eventTypes.default[0] !== 'digest.weekly_published') throw new Error('Pipedream weekly event mismatch');
if (Object.keys(zapier.creates).length !== 6 || Object.keys(zapier.searches).length !== 1) throw new Error('Zapier operation catalog mismatch');
if (Object.keys(zapier.triggers).length !== 2) throw new Error('Zapier trigger mismatch');
if (zapier.triggers.weekly_edition.operation.sample.type !== 'digest.weekly_published') throw new Error('Zapier weekly event mismatch');
console.log('clean connector consumer passed');
`,
  );
  run('node', ['smoke.mjs'], temporary);
  checks.push({
    id: 'clean-tarball-consumer',
    status: 'pass',
    durationMs: Date.now() - started,
  });
}

function run(command, args, cwd = root) {
  execFileSync(command, args, {
    cwd,
    stdio: 'inherit',
    env: { ...process.env, npm_config_update_notifier: 'false' },
    maxBuffer: 30 * 1024 * 1024,
  });
}

function revision() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim();
  } catch {
    return 'uncommitted';
  }
}

function npmVersion() {
  return execFileSync('npm', ['--version'], { encoding: 'utf8' }).trim();
}
