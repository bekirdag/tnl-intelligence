import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { readJson, root } from '../../scripts/release-lib.mjs';

const publicRecords = [
  'distribution/release/compatibility-matrix.json',
  'docs/release/README.md',
  'docs/release/operations-readiness.md',
  'docs/release/privacy-inventory.md',
  'docs/release/rollback-rehearsal.md',
  'docs/release/go-no-go.md',
  '.artifacts/tool-10/release-candidate.json',
  '.artifacts/tool-10/provenance.json',
  '.artifacts/tool-10/license-report.json',
  '.artifacts/tool-10/scan-summary.json',
];

test('release records contain no credential or private-key material', async () => {
  const content = (
    await Promise.all(
      publicRecords.map((path) => readFile(new URL(`../../${path}`, import.meta.url), 'utf8')),
    )
  ).join('\n');
  assert.doesNotMatch(content, /tnl_(?:live|prod)_[A-Za-z0-9_-]{12,}/i);
  assert.doesNotMatch(content, /BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY/);
  assert.doesNotMatch(content, /\/Users\/[^/]+/);
});

test('component security evidence has no high or critical blockers', async () => {
  const bundle = await readJson('.artifacts/tool-06/bundle-evidence.json');
  const container = await readJson('.artifacts/tool-06/container-vulnerabilities.json');
  const quant = await readJson('.artifacts/tool-09/qualification-evidence.json');
  assert.equal(bundle.archive.npmAudit.high ?? 0, 0);
  assert.equal(bundle.archive.npmAudit.critical ?? 0, 0);
  assert.equal(container.metadata.vulnerabilities.high ?? 0, 0);
  assert.equal(container.metadata.vulnerabilities.critical ?? 0, 0);
  assert.equal(quant.checks.find(({ id }) => id === 'package-security-audit')?.status, 'pass');
});

test('privacy controls cover every release surface and remain opt-in', async () => {
  const privacy = await readFile(
    new URL('../../docs/release/privacy-inventory.md', import.meta.url),
    'utf8',
  );
  for (const term of [
    'SDK, CLI, daemon',
    'Hosted gateway',
    'Webhooks',
    'Research and MCP App',
    'AI adapters',
    'Automation connectors',
    'Quant toolkit',
  ])
    assert.match(privacy, new RegExp(term.replaceAll(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
  assert.equal(
    candidate.featureFlags.find(({ name }) => name === 'TNL_RESEARCH_WEB_ENABLED')?.default,
    false,
  );
  assert.ok(candidate.featureFlags.every(({ publicationIsolation }) => publicationIsolation));
  assert.equal(candidate.publication.authorized, false);
  assert.ok(root.endsWith('tnl-intelligence'));
});
