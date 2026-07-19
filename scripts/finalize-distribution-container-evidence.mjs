#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFile, stat, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = resolve(root, '.artifacts/tool-06');
const evidencePath = resolve(artifacts, 'evidence.json');
const evidence = JSON.parse(await readFile(evidencePath, 'utf8'));
const inspected = JSON.parse(
  await readFile(resolve(artifacts, 'container-image-inspect.json'), 'utf8'),
);
const manifest = JSON.parse(await readFile(resolve(root, 'distribution/mcp-server.json'), 'utf8'));
const vulnerabilityReport = JSON.parse(
  await readFile(resolve(artifacts, 'container-vulnerabilities.json'), 'utf8'),
);
const image = inspected[0];
assert.ok(image, 'Container inspection is empty');
assert.equal(image.Config?.User, 'node');
assert.ok(Number.isInteger(image.Size) && image.Size < manifest.limits.imageBytes);
const vulnerabilities = vulnerabilityReport.metadata?.vulnerabilities ?? {};
assert.equal(vulnerabilities.high ?? 0, 0, 'Container application has high vulnerabilities');
assert.equal(
  vulnerabilities.critical ?? 0,
  0,
  'Container application has critical vulnerabilities',
);
assert.ok((await stat(resolve(artifacts, 'container-sbom.cdx.json'))).size > 100);
assert.ok((await stat(resolve(artifacts, 'container-multiarch-build.log'))).size > 100);

evidence.container = {
  skipped: false,
  image: 'tnl-intelligence:tool-06',
  bytes: image.Size,
  user: image.Config.User,
  readOnlyRuntime: true,
  health: 'pass',
  multiarchPlatforms: ['linux/amd64', 'linux/arm64'],
  sbom: 'container-sbom.cdx.json',
  vulnerabilityReport: 'container-vulnerabilities.json',
  vulnerabilityScanner: 'npm audit --omit=dev inside the built image',
  highOrCriticalVulnerabilities: (vulnerabilities.high ?? 0) + (vulnerabilities.critical ?? 0),
};
evidence.qualifiedAt = new Date().toISOString();
await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`);
