import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import test from 'node:test';
import { readJson } from '../../scripts/release-lib.mjs';

test('operations record assigns roles, severities, alerts, and runbooks', async () => {
  const operations = await readFile(
    new URL('../../docs/release/operations-readiness.md', import.meta.url),
    'utf8',
  );
  for (const term of [
    'Primary role',
    'Secondary role',
    'SEV-1',
    'Dashboards and Alerts',
    'Runbook Index',
    'Publication isolation',
  ])
    assert.match(operations, new RegExp(term));
});

test('rollback rehearsal returns every surface to a stable state', async () => {
  const evidence = await readJson('.artifacts/tool-10/rollback-evidence.json');
  assert.equal(evidence.checks.length, 8);
  assert.ok(
    evidence.checks.every(({ state, stableState }) => state === 'pass' && stableState.length > 20),
  );
});

test('required support, security, license, methodology, and change records exist', async () => {
  for (const path of [
    'SECURITY.md',
    'LICENSE',
    'CHANGELOG.md',
    'docs/research-operations.md',
    'docs/quant-research-toolkit.md',
  ])
    await access(new URL(`../../${path}`, import.meta.url));
});
