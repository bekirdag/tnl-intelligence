import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { fileRecord, readJson } from '../../scripts/release-lib.mjs';

test('the frozen candidate references the exact qualified package artifacts', async () => {
  const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
  assert.match(candidate.candidateId, /^tnl-rc-[a-f0-9]{16}$/);
  const packages = candidate.artifacts.filter(({ kind }) => kind === 'package');
  assert.ok(
    packages.length >= 10,
    'candidate must contain local npm, Python, MCP, and host packages',
  );
  for (const artifact of packages) {
    const current = await fileRecord(artifact.path);
    assert.equal(current.sha256, artifact.sha256, artifact.path);
    assert.equal(current.size, artifact.size, artifact.path);
  }

  const harness = await readJson('.artifacts/tool-01/evidence.json');
  const webhooks = await readJson('.artifacts/tool-04/evidence.json');
  const research = await readJson('.artifacts/tool-05/evidence.json');
  const connectors = await readJson('.artifacts/tool-08/qualification-evidence.json');
  const quant = await readJson('.artifacts/tool-09/qualification-evidence.json');
  assert.equal(harness.status, 'passed');
  assert.ok(webhooks.stages.every(({ result }) => result === 'pass'));
  assert.ok(research.stages.every(({ result }) => result === 'pass'));
  assert.ok(connectors.checks.every(({ status }) => status === 'pass'));
  assert.ok(quant.checks.every(({ status }) => status === 'pass'));

  const prepared = await readJson('.artifacts/tool-10/artifact-preparation-evidence.json');
  assert.equal(prepared.state, 'pass');
  assert.deepEqual(
    prepared.commands.map(({ command }) => command),
    [
      'npm run test:harness:no-container',
      'npm run test:onboarding',
      'npm run test:onboarding:browser',
      'npm run test:webhooks',
      'npm run test:research',
      'npm run test:distribution',
      'npm run test:adapters',
      'npm run test:connectors',
      'npm run test:quant',
    ],
  );
  assert.ok(prepared.commands.every(({ state }) => state === 'pass'));
});

test('candidate package artifacts contain no literal credential fixture', async () => {
  const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
  for (const artifact of candidate.artifacts.filter(({ kind }) => kind === 'package')) {
    const body = await readFile(new URL(`../../${artifact.path}`, import.meta.url));
    assert.equal(
      body.includes(Buffer.from('TNL_RELEASE_SIGNING_PRIVATE_KEY=')),
      false,
      artifact.path,
    );
  }
});
