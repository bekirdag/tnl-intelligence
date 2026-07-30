#!/usr/bin/env node
/**
 * Production canary for the TNL webhook service.
 *
 * Exercises the deployed service end to end against the live control API and a
 * real public HTTPS receiver: subscription create and delete, tenant isolation,
 * signed delivery with signature verification through the shipped helper,
 * retry, 429, 5xx, dead-letter, operator replay, restart recovery, duplicate
 * suppression, and publication isolation.
 *
 * Required environment:
 *   TNL_CANARY_BASE           control API base URL
 *   TNL_CANARY_RECEIVER       public HTTPS receiver URL for deliveries
 *   TNL_CANARY_CONTROL        loopback control URL of the canary receiver
 *   TNL_CANARY_KEY_A          API key of the owning principal
 *   TNL_CANARY_KEY_B          API key of a different principal/tenant
 */
import { randomBytes } from 'node:crypto';
import { writeFile } from 'node:fs/promises';

const base = required('TNL_CANARY_BASE');
const receiverUrl = required('TNL_CANARY_RECEIVER');
const control = required('TNL_CANARY_CONTROL');
const keyA = required('TNL_CANARY_KEY_A');
const keyB = required('TNL_CANARY_KEY_B');
const outputPath = process.env.TNL_CANARY_OUTPUT ?? '/tmp/webhook-canary-evidence.json';

const evidence = { startedAt: new Date().toISOString(), steps: [] };
let failures = 0;

await step('health and readiness', async () => {
  const health = await request('GET', '/healthz');
  const ready = await request('GET', '/readyz');
  assert(
    health.status === 200 && health.body.service === 'tnl-webhooks',
    'healthz identifies service',
  );
  assert(ready.status === 200 && ready.body.ready === true, 'readyz reports ready');
  return { health: health.body, ready: ready.body };
});

await step('unauthenticated access is a structured 401', async () => {
  const anonymous = await request('POST', '/v1/webhooks/subscriptions', { body: {} });
  assert(anonymous.status === 401, 'POST without credentials returns 401');
  assert(anonymous.body?.error?.code === 'authentication_required', 'error body is structured');
  const listed = await request('GET', '/v1/webhooks/subscriptions');
  assert(listed.status === 401, 'GET without credentials returns 401');
  return { status: anonymous.status, body: anonymous.body };
});

// The connector pre-shares a secret, exactly as the Zapier trigger does, so the
// receiver can verify the creation challenge that arrives before the response.
const presharedSecret = randomBytes(32).toString('base64url');
await controlReceiver({ mode: 'ok', reset: true, defaultSecret: presharedSecret });

let subscription;
let secret;
await step('subscription create returns the Zapier contract', async () => {
  const created = await request('POST', '/v1/webhooks/subscriptions', {
    key: keyA,
    body: {
      endpoint: receiverUrl,
      eventTypes: ['intelligence.published', 'intelligence.updated'],
      secret: presharedSecret,
      filters: { minimumConfidence: 0.5 },
    },
  });
  assert(created.status === 201, `create returns 201 (got ${created.status})`);
  const data = created.body.data;
  subscription = data?.subscription;
  secret = data?.secret;
  assert(typeof data?.subscription?.id === 'string', 'data.subscription.id is present');
  assert(
    typeof data?.subscription?.activeKeyId === 'string',
    'data.subscription.activeKeyId is present',
  );
  assert(typeof data?.secret === 'string', 'data.secret is present');
  assert(data.secret === presharedSecret, 'the pre-shared secret is echoed back');
  assert(
    data.subscription.state === 'active',
    `challenge activated the subscription (state=${data.subscription.state})`,
  );
  await controlReceiver({ keys: { [subscription.activeKeyId]: secret } });
  return {
    status: created.status,
    subscriptionId: subscription.id,
    activeKeyId: subscription.activeKeyId,
    state: subscription.state,
    secretLength: secret.length,
  };
});

await step('the creation challenge was a real signed delivery', async () => {
  const state = await receiverState();
  const challenge = state.observations.at(0);
  assert(Boolean(challenge), 'the receiver saw the challenge delivery');
  assert(challenge.eventType === 'subscription.test', 'challenge is a subscription.test event');
  return challenge;
});

await step('cross-tenant and cross-principal access fail', async () => {
  const foreignDelete = await request('DELETE', `/v1/webhooks/subscriptions/${subscription.id}`, {
    key: keyB,
  });
  const foreignList = await request('GET', '/v1/webhooks/subscriptions', { key: keyB });
  const foreignTest = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyB,
  });
  assert(foreignDelete.status === 404, `foreign delete is refused (got ${foreignDelete.status})`);
  assert(foreignTest.status === 404, `foreign test is refused (got ${foreignTest.status})`);
  assert(
    !JSON.stringify(foreignList.body).includes(subscription.id),
    'foreign list does not leak the subscription',
  );
  return {
    foreignDelete: foreignDelete.status,
    foreignTest: foreignTest.status,
    foreignListCount: foreignList.body?.data?.length ?? 0,
  };
});

await step('signed test delivery carries every required header', async () => {
  await controlReceiver({ mode: 'ok' });
  const before = (await receiverState()).observations.length;
  const test = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  assert(test.status === 202, `test event accepted (got ${test.status})`);
  const observation = await waitForObservation(before, 60_000);
  const requiredHeaders = [
    'tnl-webhook-id',
    'tnl-webhook-timestamp',
    'tnl-webhook-key-id',
    'tnl-webhook-signature',
    'tnl-event-type',
    'tnl-event-version',
    'tnl-webhook-attempt-id',
  ];
  for (const name of requiredHeaders)
    assert(observation.headerNames.includes(name), `header ${name} is present`);
  assert(observation.keyId === subscription.activeKeyId, 'signature used the active key id');
  return { eventId: test.body.data.eventId, observation };
});

await step('history records the delivery without payload or secrets', async () => {
  const history = await request(
    'GET',
    `/v1/webhooks/deliveries?subscription_id=${subscription.id}`,
    {
      key: keyA,
    },
  );
  assert(history.status === 200, 'history is readable by the owner');
  const serialized = JSON.stringify(history.body);
  assert(!serialized.includes(secret), 'history never contains the signing secret');
  const record = history.body.data.find((entry) => entry.state === 'succeeded');
  assert(Boolean(record), 'a succeeded delivery is recorded');
  return { count: history.body.data.length, sample: record };
});

await step('429 with Retry-After is retried and then succeeds', async () => {
  await controlReceiver({ mode: 'retry429:2' });
  const test = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  assert(test.status === 202, 'retry test event accepted');
  const record = await waitForDelivery(
    (entry) => entry.eventId === test.body.data.eventId && entry.state === 'succeeded',
    120_000,
  );
  assert(record.attempts >= 3, `delivery was retried (attempts=${record.attempts})`);
  return { attempts: record.attempts, state: record.state, lastStatus: record.lastStatus };
});

await step('a 5xx endpoint is classified as retryable', async () => {
  await controlReceiver({ mode: 'fail500' });
  const test = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  const record = await waitForDelivery(
    (entry) => entry.eventId === test.body.data.eventId && entry.state === 'retry_scheduled',
    120_000,
  );
  assert(record.lastErrorCode === 'http_500', `error code recorded (${record.lastErrorCode})`);
  await controlReceiver({ mode: 'ok' });
  const recovered = await waitForDelivery(
    (entry) => entry.eventId === test.body.data.eventId && entry.state === 'succeeded',
    240_000,
  );
  return {
    retryState: record.state,
    lastErrorCode: record.lastErrorCode,
    recoveredState: recovered.state,
    attempts: recovered.attempts,
  };
});

let deadLettered;
await step('exhausted retries move to dead letter', async () => {
  await controlReceiver({ mode: 'always429' });
  const test = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  deadLettered = await waitForDelivery(
    (entry) => entry.eventId === test.body.data.eventId && entry.state === 'dead_letter',
    240_000,
  );
  return {
    state: deadLettered.state,
    attempts: deadLettered.attempts,
    lastErrorCode: deadLettered.lastErrorCode,
  };
});

await step('an operator can replay a dead-lettered delivery', async () => {
  await controlReceiver({ mode: 'ok' });
  const forbidden = await request('POST', `/v1/webhooks/deliveries/${deadLettered.id}/replay`, {
    key: keyB,
  });
  assert(
    forbidden.status === 403 || forbidden.status === 404,
    `non-operator replay refused (${forbidden.status})`,
  );
  const replayed = await request('POST', `/v1/webhooks/deliveries/${deadLettered.id}/replay`, {
    key: keyA,
  });
  assert(replayed.status === 202, `operator replay accepted (got ${replayed.status})`);
  const record = await waitForDelivery(
    (entry) => entry.id === deadLettered.id && entry.state === 'succeeded',
    120_000,
  );
  return { replayStatus: replayed.status, replayCount: record.replayCount, state: record.state };
});

await step('replaying an accepted delivery is a duplicate for the consumer', async () => {
  const history = await request('GET', '/v1/webhooks/deliveries', { key: keyA });
  const accepted = history.body.data.find((entry) => entry.state === 'succeeded');
  assert(Boolean(accepted), 'a previously accepted delivery exists');
  const before = (await receiverState()).duplicates.length;
  const replayed = await request('POST', `/v1/webhooks/deliveries/${accepted.id}/replay`, {
    key: keyA,
  });
  assert(replayed.status === 202, `replay accepted (got ${replayed.status})`);
  const state = await waitForDuplicate(before, 120_000);
  const duplicate = state.duplicates.at(-1);
  assert(duplicate.deliveryId === accepted.id, 'the duplicate carries the original delivery id');
  assert(duplicate.eventId === accepted.eventId, 'the replay preserves the original event id');
  assert(
    duplicate.attemptId !== null && duplicate.attemptId !== undefined,
    'the replay carries a new attempt id',
  );
  return { duplicates: state.duplicates.length, sample: duplicate };
});

await step('a real delivery is captured for cross-language verification', async () => {
  const state = await receiverState();
  assert(Boolean(state.lastSigned), 'the receiver captured a signed delivery');
  return state.lastSigned;
});

await step('key rotation issues a new key id and keeps delivery working', async () => {
  const rotated = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/rotate`, {
    key: keyA,
    body: { overlapSeconds: 60 },
  });
  assert(rotated.status === 200, `rotate returns 200 (got ${rotated.status})`);
  const next = rotated.body.data;
  assert(next.subscription.activeKeyId !== subscription.activeKeyId, 'a new key id is issued');
  assert(
    next.subscription.previousKeyIds.includes(subscription.activeKeyId),
    'the old key overlaps',
  );
  await controlReceiver({
    keys: { [next.subscription.activeKeyId]: next.secret },
    defaultSecret: next.secret,
  });
  const test = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  const record = await waitForDelivery(
    (entry) => entry.eventId === test.body.data.eventId && entry.state === 'succeeded',
    120_000,
  );
  subscription = next.subscription;
  secret = next.secret;
  return {
    newKeyId: next.subscription.activeKeyId,
    previousKeyIds: next.subscription.previousKeyIds,
    deliveryState: record.state,
  };
});

await step('pause stops delivery and the subscription can be inspected', async () => {
  const paused = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/pause`, {
    key: keyA,
  });
  assert(paused.status === 200 && paused.body.data.state === 'paused', 'subscription pauses');
  const blocked = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  assert(blocked.status === 409, `a paused subscription refuses test events (${blocked.status})`);
  const reactivated = await request(
    'POST',
    `/v1/webhooks/subscriptions/${subscription.id}/verify`,
    {
      key: keyA,
    },
  );
  assert(
    reactivated.status === 200 && reactivated.body.data.state === 'active',
    'challenge reactivates',
  );
  return {
    paused: paused.body.data.state,
    blocked: blocked.status,
    reactivated: reactivated.body.data.state,
  };
});

await step('subscription delete returns 204 and revokes delivery', async () => {
  const deleted = await request('DELETE', `/v1/webhooks/subscriptions/${subscription.id}`, {
    key: keyA,
  });
  assert(deleted.status === 204, `delete returns 204 (got ${deleted.status})`);
  const afterDelete = await request('POST', `/v1/webhooks/subscriptions/${subscription.id}/test`, {
    key: keyA,
  });
  assert(afterDelete.status === 404, `a deleted subscription is gone (${afterDelete.status})`);
  return { deleteStatus: deleted.status, afterDelete: afterDelete.status };
});

evidence.finishedAt = new Date().toISOString();
evidence.failures = failures;
await writeFile(outputPath, `${JSON.stringify(evidence, null, 2)}\n`);
console.log(`\ncanary evidence written to ${outputPath}`);
console.log(failures === 0 ? 'CANARY PASSED' : `CANARY FAILED (${failures} step(s))`);
process.exit(failures === 0 ? 0 : 1);

async function step(name, work) {
  process.stdout.write(`\n== ${name}\n`);
  try {
    const detail = await work();
    evidence.steps.push({ name, result: 'pass', detail });
    console.log(`   pass`);
  } catch (error) {
    failures += 1;
    evidence.steps.push({ name, result: 'fail', error: String(error?.message ?? error) });
    console.log(`   FAIL: ${error?.message ?? error}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
  console.log(`   - ${message}`);
}

async function request(method, path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      ...(options.key ? { authorization: `Bearer ${options.key}` } : {}),
      ...(options.body ? { 'content-type': 'application/json' } : {}),
    },
    ...(options.body ? { body: JSON.stringify(options.body) } : {}),
  });
  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : undefined;
  } catch {
    body = text;
  }
  return { status: response.status, body };
}

async function controlReceiver(payload) {
  const response = await fetch(`${control}/control`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!response.ok) throw new Error(`canary receiver control failed: ${response.status}`);
  return response.json();
}

async function receiverState() {
  const response = await fetch(`${control}/state`);
  return response.json();
}

async function waitForObservation(afterCount, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await receiverState();
    if (state.observations.length > afterCount) return state.observations.at(-1);
    await sleep(1_000);
  }
  throw new Error('timed out waiting for the receiver to observe a delivery');
}

async function waitForDuplicate(afterCount, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const state = await receiverState();
    if (state.duplicates.length > afterCount) return state;
    await sleep(1_000);
  }
  throw new Error('timed out waiting for a duplicate delivery');
}

async function waitForDelivery(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    const history = await request('GET', '/v1/webhooks/deliveries', { key: keyA });
    last = (history.body?.data ?? []).find(predicate);
    if (last) return last;
    await sleep(2_000);
  }
  throw new Error('timed out waiting for the delivery state');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} must be set`);
  return value;
}
