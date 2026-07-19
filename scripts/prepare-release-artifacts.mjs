#!/usr/bin/env node
import { spawnSync } from 'node:child_process';
import { root, writeJsonAtomic } from './release-lib.mjs';

const commands = [
  ['npm', ['run', 'test:harness:no-container']],
  ['npm', ['run', 'test:onboarding']],
  ['npm', ['run', 'test:onboarding:browser']],
  ['npm', ['run', 'test:webhooks']],
  ['npm', ['run', 'test:research']],
  ['npm', ['run', 'test:distribution']],
  ['npm', ['run', 'test:adapters']],
  ['npm', ['run', 'test:connectors']],
  ['npm', ['run', 'test:quant']],
];
const evidence = {
  schemaVersion: '1.0.0',
  generatedAt: new Date().toISOString(),
  state: 'running',
  commands: [],
};

for (const [file, args] of commands) {
  const startedAt = Date.now();
  const rendered = [file, ...args].join(' ');
  const result = spawnSync(file, args, {
    cwd: root,
    env: process.env,
    stdio: 'inherit',
    maxBuffer: 128 * 1024 * 1024,
  });
  evidence.commands.push({
    command: rendered,
    state: result.status === 0 ? 'pass' : 'fail',
    durationMs: Date.now() - startedAt,
  });
  if (result.status !== 0) {
    evidence.state = 'fail';
    await writeJsonAtomic('.artifacts/tool-10/artifact-preparation-evidence.json', evidence);
    throw new Error(`Release artifact preparation failed: ${rendered}`);
  }
}

evidence.state = 'pass';
evidence.generatedAt = new Date().toISOString();
await writeJsonAtomic('.artifacts/tool-10/artifact-preparation-evidence.json', evidence);
console.log('Tools 01-09 release artifacts prepared and qualified.');
