import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { describe, it } from 'node:test';
import { CONNECTOR_OPERATIONS } from '../../packages/connectors/dist/index.js';

const parity = JSON.parse(
  await readFile(new URL('../../connectors/generated/parity.json', import.meta.url), 'utf8'),
);

describe('connector parity catalog', () => {
  it('maps every shared operation and trigger to every host', () => {
    assert.deepEqual(
      parity.operations.map((operation) => operation.id),
      CONNECTOR_OPERATIONS.map((operation) => operation.id),
    );
    for (const operation of parity.operations) {
      assert.equal(operation.n8n, true, operation.id);
      assert.equal(operation.pipedream, true, operation.id);
      assert.equal(operation.zapier, true, operation.id);
    }
    for (const trigger of parity.triggers) {
      assert.equal(trigger.n8n, true, trigger.type);
      assert.equal(trigger.pipedream, true, trigger.type);
      assert.equal(trigger.zapier, true, trigger.type);
    }
  });

  it('freezes exact-body verification, lifecycle cleanup, and no-backfill defaults', () => {
    assert.equal(parity.guarantees.signedRawBody, true);
    assert.equal(parity.guarantees.stableDedupeId, 'eventId:revision');
    assert.equal(parity.guarantees.subscribe, true);
    assert.equal(parity.guarantees.unsubscribe, true);
    assert.equal(parity.guarantees.pollingBackfillDefault, false);
  });
});
