import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import {
  InMemoryReplayStore,
  VerificationError,
  signWebhook,
  validateWebhookEvent,
  verifyWebhook,
} from '../src/index.js';
import { fixture } from './helpers.js';

describe('webhook contract and signing', () => {
  it('creates a bounded v1 envelope and rejects unknown or oversized fields', () => {
    const event = fixture();
    assert.deepEqual(validateWebhookEvent(event), []);
    assert.equal(event.schemaVersion, '1.0');
    assert.ok(event.id.startsWith('evt_'));
    const unknown = { ...event, articleBody: 'not allowed' };
    assert.match(validateWebhookEvent(unknown).join(','), /articleBody is not allowed/);
    assert.match(
      validateWebhookEvent({ ...event, data: { ...event.data, summary: 'x'.repeat(70_000) } }).join(
        ',',
      ),
      /summary is invalid|64 KiB/,
    );
  });

  it('verifies exact raw bytes, rotated keys, time bounds, tampering, and replay', async () => {
    const event = fixture();
    const rawBody = Buffer.from(JSON.stringify(event));
    const current = Buffer.alloc(32, 7);
    const previous = Buffer.alloc(32, 4);
    const timestamp = Math.floor(Date.now() / 1_000);
    const headers = signWebhook({
      event,
      rawBody,
      deliveryId: 'dlv_abcdefghijklmnop',
      keyId: 'key_current123',
      secret: current,
      timestamp,
    });
    const replay = new InMemoryReplayStore();
    const verified = await verifyWebhook({
      rawBody,
      headers,
      keys: { key_current123: current, key_previous123: previous },
      replayStore: replay,
      now: timestamp,
    });
    assert.equal(verified.keyId, 'key_current123');
    await assert.rejects(
      () =>
        verifyWebhook({
          rawBody,
          headers,
          keys: { key_current123: current },
          replayStore: replay,
          now: timestamp,
        }),
      error('duplicate_delivery'),
    );
    await assert.rejects(
      () =>
        verifyWebhook({
          rawBody: Buffer.concat([rawBody, Buffer.from(' ')]),
          headers,
          keys: { key_current123: current },
          now: timestamp,
        }),
      error('invalid_signature'),
    );
    await assert.rejects(
      () =>
        verifyWebhook({
          rawBody,
          headers,
          keys: { key_current123: current },
          now: timestamp + 301,
        }),
      error('stale_timestamp'),
    );
  });

  it('verifies the canonical fixture shared with Python consumers', async () => {
    const corpus = JSON.parse(
      readFileSync(
        new URL('../../../test/fixtures/webhooks/signed-published-v1.json', import.meta.url),
        'utf8',
      ),
    );
    const result = await verifyWebhook({
      rawBody: corpus.rawBody,
      headers: corpus.headers,
      keys: { key_current123: Buffer.from(corpus.testKeyBase64url, 'base64url') },
      now: Number(corpus.headers['TNL-Webhook-Timestamp']),
    });
    assert.equal(result.deliveryId, corpus.headers['TNL-Webhook-Id']);
    assert.deepEqual(JSON.parse(corpus.rawBody), corpus.event);
  });
});

function error(code: string): (value: unknown) => boolean {
  return (value) => value instanceof VerificationError && value.code === code;
}
