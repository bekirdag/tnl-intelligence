import assert from 'node:assert/strict';
import { verify } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import test from 'node:test';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { fileRecord, readJson, root } from '../../scripts/release-lib.mjs';

test('release schemas validate the candidate and compatibility matrix', async () => {
  const ajv = new Ajv2020({ allErrors: true, strict: false });
  addFormats(ajv);
  const cases = [
    ['schemas/release/release-candidate.schema.json', '.artifacts/tool-10/release-candidate.json'],
    [
      'schemas/release/compatibility-matrix.schema.json',
      'distribution/release/compatibility-matrix.json',
    ],
  ];
  for (const [schemaPath, valuePath] of cases) {
    const schema = await readJson(schemaPath);
    const value = await readJson(valuePath);
    const valid = ajv.compile(schema)(value);
    assert.equal(valid, true, JSON.stringify(ajv.errors));
  }
  try {
    const schema = await readJson('schemas/release/evidence-index.schema.json');
    const value = await readJson('.artifacts/tool-10/evidence-index.json');
    const validate = ajv.compile(schema);
    assert.equal(validate(value), true, JSON.stringify(validate.errors));
    assert.ok(value.scenarios.every(({ candidateId }) => candidateId === value.candidateId));
  } catch (error) {
    if (error?.code !== 'ENOENT') throw error;
  }
});

test('candidate hashes and package boundaries agree with disk', async () => {
  const candidate = await readJson('.artifacts/tool-10/release-candidate.json');
  assert.equal(candidate.publication.authorized, false);
  assert.equal(candidate.publication.sideEffectAllowed, false);
  assert.ok(candidate.packages.some(({ kind }) => kind === 'python'));
  assert.ok(candidate.packages.some(({ kind }) => kind === 'mcp-bundle'));
  for (const record of [...candidate.contracts, ...candidate.artifacts, ...candidate.fixtures]) {
    const current = await fileRecord(record.path);
    assert.equal(current.sha256, record.sha256, record.path);
    assert.equal(current.size, record.size, record.path);
  }
});

test('compatibility matrix covers tested, contract, canary, and unsupported combinations', async () => {
  const matrix = await readJson('distribution/release/compatibility-matrix.json');
  const statuses = new Set(matrix.pairwise.map(({ status }) => status));
  assert.deepEqual(statuses, new Set(['tested', 'contract-tested', 'owner-canary']));
  assert.ok(matrix.unsupported.some(({ combination }) => combination.includes('Brokerage')));
  assert.ok(matrix.contracts.some(({ name }) => name.includes('Quant')));
});

test('technical signature verifies when present', async () => {
  let signature;
  try {
    signature = await readJson('.artifacts/tool-10/technical-signature.json');
  } catch {
    return;
  }
  if (!signature.publicKey) return;
  const body = await readFile(resolve(root, '.artifacts/tool-10/release-candidate.json'));
  assert.equal(
    verify(null, body, signature.publicKey, Buffer.from(signature.signature, 'base64')),
    true,
  );
});
