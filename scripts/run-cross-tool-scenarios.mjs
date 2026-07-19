#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { readJson, root, writeJsonAtomic } from './release-lib.mjs';

const candidate = await readJson('.artifacts/tool-10/release-candidate.json');

const selected = process.argv.find((argument) => argument.startsWith('--scenario='))?.split('=')[1];
const scenarios = [
  {
    id: 'scenario-1',
    name: 'Frozen artifact consumption',
    commands: [['node', ['--test', 'test/release/candidate-artifacts.test.mjs']]],
  },
  {
    id: 'scenario-2',
    name: 'Hosted MCP research',
    commands: [
      [
        'npx',
        [
          'tsx',
          '--test',
          'packages/gateway/test/gateway.test.ts',
          'packages/gateway/test/research.test.ts',
        ],
      ],
    ],
  },
  {
    id: 'scenario-3',
    name: 'Publish to webhook to automation, research, and quant',
    commands: [['node', ['--test', 'test/release/cross-tool-flow.test.mjs']]],
  },
  {
    id: 'scenario-4',
    name: 'AI client workflow',
    commands: [
      [
        'node',
        [
          '--test',
          'test/adapters/cursor.test.mjs',
          'test/adapters/openai.test.mjs',
          'test/adapters/security.test.mjs',
          'test/release/ai-client-workflow.test.mjs',
        ],
      ],
    ],
  },
  {
    id: 'scenario-5',
    name: 'Quantitative snapshot',
    commands: [
      [
        '.venv/bin/python',
        [
          '-m',
          'pytest',
          'python/tnl_intelligence/tests/quant/test_lake.py',
          'python/tnl_intelligence/tests/quant/test_validation_features.py',
          '-q',
        ],
      ],
    ],
  },
  {
    id: 'scenario-6',
    name: 'Degraded operations and recovery',
    commands: [
      [
        'npx',
        [
          'tsx',
          '--test',
          'packages/gateway/test/gateway.test.ts',
          'packages/gateway/test/research.test.ts',
          'packages/research/test/orchestrator.test.ts',
          'packages/research/test/server.test.ts',
          'packages/events/test/pipeline.test.ts',
          'packages/events/test/security.test.ts',
        ],
      ],
    ],
  },
];

const requested = selected
  ? scenarios.filter(({ id }) => id === `scenario-${selected}`)
  : scenarios;
if (requested.length === 0) throw new Error(`Unknown scenario: ${selected}`);
let evidence = {
  schemaVersion: '1.0.0',
  candidateId: candidate.candidateId,
  sourceDigest: candidate.source.sourceDigest,
  generatedAt: new Date().toISOString(),
  scenarios: [],
};
try {
  const existing = JSON.parse(
    await readFile(resolve(root, '.artifacts/tool-10/scenario-evidence.json'), 'utf8'),
  );
  if (existing.candidateId === candidate.candidateId) evidence = existing;
} catch {}

for (const scenario of requested) {
  const startedAt = Date.now();
  const renderedCommands = [];
  let state = 'pass';
  try {
    console.log(`Running ${scenario.id}: ${scenario.name}`);
    for (const [file, args] of scenario.commands) {
      renderedCommands.push([file, ...args].join(' '));
      const result = spawnSync(file, args, {
        cwd: root,
        env: process.env,
        stdio: 'inherit',
        maxBuffer: 128 * 1024 * 1024,
      });
      if (result.status !== 0)
        throw new Error(`${file} ${args.join(' ')} failed (${result.status})`);
    }
  } catch (error) {
    state = 'fail';
    evidence.scenarios = upsert(evidence.scenarios, {
      id: scenario.id,
      name: scenario.name,
      state,
      durationMs: Date.now() - startedAt,
      commands: renderedCommands,
      candidateId: candidate.candidateId,
    });
    await writeJsonAtomic('.artifacts/tool-10/scenario-evidence.json', evidence);
    throw error;
  }
  evidence.scenarios = upsert(evidence.scenarios, {
    id: scenario.id,
    name: scenario.name,
    state,
    durationMs: Date.now() - startedAt,
    commands: renderedCommands,
    candidateId: candidate.candidateId,
  });
  await writeJsonAtomic('.artifacts/tool-10/scenario-evidence.json', evidence);
}

evidence.generatedAt = new Date().toISOString();
evidence.scenarios.sort((left, right) => left.id.localeCompare(right.id));
await writeJsonAtomic('.artifacts/tool-10/scenario-evidence.json', evidence);
console.log(`${requested.length} cross-tool scenario(s) passed.`);

function upsert(items, value) {
  return [...items.filter(({ id }) => id !== value.id), value];
}
