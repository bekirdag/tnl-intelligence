#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { copyFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  fileRecord,
  readJson,
  root,
  run,
  technicalGates,
  walkFiles,
  writeJsonAtomic,
} from './release-lib.mjs';

const lane =
  process.argv.find((argument) => argument.startsWith('--lane='))?.split('=')[1] ?? 'release';
const laneCommands = {
  contracts: [
    ['npm', ['run', 'openapi:check']],
    ['npm', ['run', 'onboarding:check']],
    ['npm', ['run', 'webhooks:check']],
    ['npm', ['run', 'research:check']],
    ['npm', ['run', 'distribution:check']],
    ['npm', ['run', 'adapters:check']],
    ['npm', ['run', 'connectors:check']],
    ['npm', ['run', 'quant:check']],
    ['node', ['--test', 'test/release/contracts.test.mjs']],
  ],
  security: [
    ['npm', ['audit', '--omit=dev', '--audit-level=high']],
    ['npm', ['run', 'test:webhooks:security']],
    ['npm', ['run', 'test:research:security']],
    ['npm', ['run', 'test:adapters:security']],
    [
      'npx',
      [
        'tsx',
        '--test',
        'packages/gateway/test/auth.test.ts',
        'packages/gateway/test/gateway.test.ts',
      ],
    ],
    ['node', ['--test', 'test/release/security-privacy.test.mjs']],
  ],
  privacy: [['node', ['--test', 'test/release/security-privacy.test.mjs']]],
  reliability: [
    ['npm', ['run', 'test:webhooks:load']],
    ['node', ['scripts/run-capacity-chaos.mjs']],
    ['node', ['scripts/run-rollback-rehearsal.mjs']],
  ],
  performance: [
    ['node', ['scripts/run-capacity-chaos.mjs']],
    ['node', ['--test', 'test/release/performance.test.mjs']],
  ],
  accessibility: [['node', ['--test', 'test/release/accessibility-artifacts.test.mjs']]],
  docs: [['node', ['--test', 'test/release/docs.test.mjs']]],
  operations: [
    ['node', ['scripts/run-rollback-rehearsal.mjs']],
    ['node', ['--test', 'test/release/operations.test.mjs']],
  ],
};

if (lane === 'e2e') {
  executeCommand('node', ['scripts/prepare-release-artifacts.mjs']);
  executeCommand('node', ['scripts/release-candidate-assets.mjs']);
  execute('functional', [['node', ['scripts/run-cross-tool-scenarios.mjs']]]);
  executeCommand('node', ['scripts/release-candidate-assets.mjs', '--check']);
  console.log('Cross-tool functional qualification passed.');
  process.exit(0);
}

if (lane !== 'release') {
  if (!laneCommands[lane]) throw new Error(`Unknown qualification lane: ${lane}`);
  executeCommand('node', ['scripts/release-candidate-assets.mjs']);
  execute(lane, laneCommands[lane]);
  executeCommand('node', ['scripts/release-candidate-assets.mjs', '--check']);
  console.log(`${lane} qualification passed.`);
  process.exit(0);
}

const laneResults = [];
executeCommand('node', ['scripts/prepare-release-artifacts.mjs']);
executeCommand('node', ['scripts/release-candidate-assets.mjs']);
laneResults.push(execute('functional', [['node', ['scripts/run-cross-tool-scenarios.mjs']]]));
for (const name of [
  'contracts',
  'security',
  'privacy',
  'reliability',
  'performance',
  'accessibility',
  'docs',
  'operations',
])
  laneResults.push(execute(name, laneCommands[name]));

// No lane may mutate the Tool 01-09 artifact set after the candidate is frozen.
executeCommand('node', ['scripts/release-candidate-assets.mjs', '--check']);
executeCommand('node', ['--test', 'test/release/contracts.test.mjs']);
const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
for (const result of laneResults) {
  result.candidateId = candidate.candidateId;
  await writeJsonAtomic(`.artifacts/tool-10/${result.id}-evidence.json`, result);
}

candidate.qualification = {
  ...candidate.qualification,
  state: 'passed',
  gates: [...technicalGates('pass'), { id: 'business-approval', state: 'pending-owner' }],
};
await writeJsonAtomic('.artifacts/tool-10/release-candidate.json', candidate);
await copyFile(
  resolve(root, 'distribution/release/compatibility-matrix.json'),
  resolve(root, '.artifacts/tool-10/compatibility-matrix.json'),
);

// Regeneration preserves final gate state for the same candidate and signs only the technical manifest.
executeCommand('node', ['scripts/release-candidate-assets.mjs', '--sign']);
await writeJsonAtomic('.artifacts/tool-10/scan-summary.json', {
  schemaVersion: '1.0.0',
  candidateId: candidate.candidateId,
  generatedAt: new Date().toISOString(),
  state: 'pass',
  blockerPolicy: { critical: 0, high: 0, credentialMatches: 0 },
  evidence: [
    '.artifacts/tool-06/container-vulnerabilities.json',
    '.artifacts/tool-06/bundle-evidence.json',
    '.artifacts/tool-09/qualification-evidence.json',
    '.artifacts/tool-10/security-evidence.json',
    '.artifacts/tool-10/privacy-evidence.json',
  ],
});

const recordPaths = (await walkFiles('.artifacts/tool-10')).filter(
  (path) => !path.endsWith('/evidence-index.json'),
);
const records = await Promise.all(recordPaths.map((path) => fileRecord(path)));
const scenarioEvidence = await readJson('.artifacts/tool-10/scenario-evidence.json');
const lanes = [
  ...laneResults.map(({ id }) => ({
    id,
    state: 'pass',
    evidence: [`.artifacts/tool-10/${id}-evidence.json`],
  })),
  { id: 'business-approval', state: 'pending-owner', evidence: ['docs/release/go-no-go.md'] },
];
const evidenceIndex = {
  schemaVersion: '1.0.0',
  candidateId: candidate.candidateId,
  generatedAt: new Date().toISOString(),
  lanes,
  scenarios: scenarioEvidence.scenarios,
  records,
  decision: { technical: 'go', publication: 'no-go-pending-owner', ownerApprovalRequired: true },
};
await writeJsonAtomic('.artifacts/tool-10/evidence-index.json', evidenceIndex);
executeCommand('node', [
  '--test',
  'test/release/contracts.test.mjs',
  'test/release/operations.test.mjs',
]);
executeCommand('node', ['scripts/release-candidate-assets.mjs', '--check']);
console.log(
  `Tool 10 release qualification passed for ${candidate.candidateId}; publication remains pending owner approval.`,
);

function execute(id, commands) {
  const startedAt = Date.now();
  const rendered = [];
  try {
    for (const [file, args] of commands) {
      rendered.push([file, ...args].join(' '));
      executeCommand(file, args);
    }
  } catch (error) {
    const result = {
      schemaVersion: '1.0.0',
      id,
      state: 'fail',
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      commands: rendered,
    };
    writeJsonAtomic(`.artifacts/tool-10/${id}-evidence.json`, result).catch(() => {});
    throw error;
  }
  return {
    schemaVersion: '1.0.0',
    id,
    state: 'pass',
    generatedAt: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    commands: rendered,
  };
}

function executeCommand(file, args) {
  const result = spawnSync(file, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.status !== 0) throw new Error(`${file} ${args.join(' ')} failed (${result.status})`);
}
