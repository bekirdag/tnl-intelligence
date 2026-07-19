#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { root, writeJsonAtomic } from './release-lib.mjs';

const checks = [
  {
    id: 'mcp-gateway-downgrade',
    command: ['npm', ['test', '--workspace', '@theneuralledger/artifacts']],
    stableState: 'Prior generic local/remote bundle remains discoverable and doctor-verifiable.',
  },
  {
    id: 'research-skill-restore',
    command: [
      'npx',
      [
        'tsx',
        '--test',
        'packages/research/test/contracts.test.ts',
        'packages/research/test/evals.test.ts',
      ],
    ],
    stableState: 'Versioned prior skill contracts and deterministic evaluations remain readable.',
  },
  {
    id: 'webhook-backlog-replay',
    command: ['npx', ['tsx', '--test', 'packages/events/test/pipeline.test.ts']],
    stableState:
      'Committed outbox entries survive interruption and replay once by idempotency key.',
  },
  {
    id: 'adapter-connector-fallback',
    command: ['npm', ['run', 'test:connectors:parity']],
    stableState: 'Host adapters preserve generic MCP/API action and trigger semantics.',
  },
  {
    id: 'quant-derived-rebuild',
    command: [
      '.venv/bin/python',
      [
        '-m',
        'pytest',
        'python/tnl_intelligence/tests/quant/test_lake.py',
        'python/tnl_intelligence/tests/quant/test_validation_features.py',
        '-q',
      ],
    ],
    stableState: 'Immutable observations reproduce point-in-time manifests and versioned features.',
  },
  {
    id: 'credential-revocation',
    command: ['npx', ['tsx', '--test', 'packages/gateway/test/auth.test.ts']],
    stableState:
      'Revoked or expired credentials fail and replacement credentials retain tenant scope.',
  },
  {
    id: 'schema-forward-fix',
    command: ['npm', ['run', 'openapi:check']],
    stableState:
      'Canonical contract and generated clients agree after rollback or versioned forward-fix.',
  },
  {
    id: 'repository-state-restore',
    command: ['npx', ['tsx', '--test', 'test/release/state-recovery.test.ts']],
    stableState:
      'Portable outbox and research records restore with stable identities and tenant isolation.',
  },
];
const evidence = { schemaVersion: '1.0.0', generatedAt: new Date().toISOString(), checks: [] };

for (const check of checks) {
  const startedAt = Date.now();
  const [file, args] = check.command;
  const result = spawnSync(file, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    maxBuffer: 128 * 1024 * 1024,
  });
  const record = {
    id: check.id,
    state: result.status === 0 ? 'pass' : 'fail',
    durationMs: Date.now() - startedAt,
    command: [file, ...args].join(' '),
    stableState: check.stableState,
  };
  evidence.checks.push(record);
  await writeJsonAtomic('.artifacts/tool-10/rollback-evidence.json', evidence);
  if (result.status !== 0) throw new Error(`Rollback rehearsal failed: ${check.id}`);
}

console.log('Rollback rehearsal passed.');
