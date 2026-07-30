import assert from 'node:assert/strict';
import { createHash, randomBytes } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { describe, it } from 'node:test';
import { parseWebhookServiceConfig, parseSimpleYaml } from '../src/production/config.js';
import {
  MysqlMemberKeyDirectory,
  TnlControlAuthenticator,
  type MemberKeyDirectory,
  type MemberKeyRecord,
} from '../src/production/identity.js';
import {
  EnvelopeSecretProtector,
  LocalKeyManagementService,
  SecretProtectionError,
  type WrappedDataKey,
  type WrappedKeyStore,
} from '../src/production/kms.js';
import { SubscriptionError } from '../src/subscriptions.js';

const configPath = fileURLToPath(
  new URL('../../../deploy/webhooks/config.example.yaml', import.meta.url),
);

class MemoryWrappedKeyStore implements WrappedKeyStore {
  readonly keys: WrappedDataKey[] = [];

  async load(): Promise<WrappedDataKey[]> {
    return this.keys.map((key) => ({ ...key }));
  }

  async save(wrapped: WrappedDataKey): Promise<void> {
    if (!this.keys.some((key) => key.keyId === wrapped.keyId)) this.keys.push({ ...wrapped });
  }
}

class MemoryDirectory implements MemberKeyDirectory {
  constructor(readonly records: Record<string, MemberKeyRecord>) {}

  async findByHash(keyHash: string): Promise<MemberKeyRecord | undefined> {
    return this.records[keyHash];
  }

  async health(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}
}

function request(headers: Record<string, string>): IncomingMessage {
  return { headers } as unknown as IncomingMessage;
}

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

describe('production configuration', () => {
  it('parses the deployed configuration template', async () => {
    const config = parseWebhookServiceConfig(await readFile(configPath, 'utf8'));
    assert.equal(config.service.bindHost, '127.0.0.1');
    assert.equal(config.service.bindPort, 7322);
    assert.equal(config.service.producerEnabled, false);
    assert.equal(config.service.dispatcherEnabled, true);
    assert.equal(config.service.autoVerifyOnCreate, true);
    assert.equal(config.database.urlEnv, 'TNL_WEBHOOK_DATABASE_URL');
    assert.equal(config.kms.provider, 'local-keyring');
    assert.equal(config.identity.defaultTenantId, 'tnl_public');
    assert.equal(config.identity.operatorRole, 'tnl-webhook-operator');
    assert.deepEqual(config.egress.allowedPorts, [443]);
    assert.equal(config.egress.requireHttps, true);
  });

  it('reads nested mappings, inline sequences, and block sequences', () => {
    const parsed = parseSimpleYaml(
      ['a:', '  b: 1', '  c: [x, y]', 'd:', '  - one', '  - two', 'e: "# not a comment"'].join(
        '\n',
      ),
    );
    assert.deepEqual(parsed, {
      a: { b: '1', c: ['x', 'y'] },
      d: ['one', 'two'],
      e: '# not a comment',
    });
  });

  it('rejects malformed configuration instead of silently defaulting', () => {
    assert.throws(() => parseSimpleYaml('service:\n  bind_port\n'), /invalid configuration syntax/);
  });
});

describe('KMS-backed secret protection', () => {
  const keyOne = { id: 'kek-1', material: randomBytes(32) };
  const keyTwo = { id: 'kek-2', material: randomBytes(32) };

  it('seals and opens secrets through a wrapped data key', async () => {
    const store = new MemoryWrappedKeyStore();
    const protector = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne], 'kek-1'),
      store,
    );
    await protector.initialize();
    const secret = randomBytes(32);
    const sealed = protector.encrypt(secret);
    assert.ok(sealed.startsWith('v1.kek-1.'));
    assert.ok(!sealed.includes(secret.toString('base64url')));
    assert.deepEqual(protector.decrypt(sealed), secret);
    assert.equal(await protector.health(), true);
    assert.equal(store.keys.length, 1);
  });

  it('survives a restart because the data key is wrapped, not regenerated', async () => {
    const store = new MemoryWrappedKeyStore();
    const first = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne], 'kek-1'),
      store,
    );
    await first.initialize();
    const secret = randomBytes(32);
    const sealed = first.encrypt(secret);
    const second = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne], 'kek-1'),
      store,
    );
    await second.initialize();
    assert.deepEqual(second.decrypt(sealed), secret);
  });

  it('keeps earlier versions readable after the wrapping key rotates', async () => {
    const store = new MemoryWrappedKeyStore();
    const before = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne], 'kek-1'),
      store,
    );
    await before.initialize();
    const secret = randomBytes(32);
    const sealed = before.encrypt(secret);
    const after = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne, keyTwo], 'kek-2'),
      store,
    );
    await after.initialize();
    assert.equal(after.activeKeyId, 'kek-2');
    assert.deepEqual(after.decrypt(sealed), secret);
    assert.ok(after.encrypt(secret).startsWith('v1.kek-2.'));
  });

  it('fails closed when a wrapping key version is withdrawn', async () => {
    const store = new MemoryWrappedKeyStore();
    const before = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyOne], 'kek-1'),
      store,
    );
    await before.initialize();
    const sealed = before.encrypt(randomBytes(32));
    const after = new EnvelopeSecretProtector(
      new LocalKeyManagementService([keyTwo], 'kek-2'),
      store,
    );
    await after.initialize();
    assert.throws(() => after.decrypt(sealed), SecretProtectionError);
  });

  it('rejects malformed keyrings and short key material', () => {
    assert.throws(() => new LocalKeyManagementService([]), SecretProtectionError);
    assert.throws(
      () => new LocalKeyManagementService([{ id: 'kek-1', material: randomBytes(16) }]),
      SecretProtectionError,
    );
    assert.throws(() => new LocalKeyManagementService([keyOne], 'missing'), SecretProtectionError);
  });
});

describe('production identity and tenant authorization', () => {
  const apiKey = 'tnl_live_test_key_material';
  const directory = new MemoryDirectory({
    [sha256Hex(apiKey)]: {
      id: 'key-1',
      ownerSub: 'owner-a',
      planSlug: 'analyst',
      emailVerifiedAt: '2026-01-01T00:00:00Z',
    },
    [sha256Hex('unverified-free-key')]: {
      id: 'key-2',
      ownerSub: 'owner-b',
      planSlug: 'free',
      emailVerifiedAt: null,
    },
  });

  it('resolves the tenant on the server, never from the request', async () => {
    const identity = new TnlControlAuthenticator({
      directory,
      defaultTenantId: 'tnl_public',
      tenantOverrides: { 'owner-z': 'tenant_dedicated' },
    });
    const actor = await identity.authenticate(
      request({ authorization: `Bearer ${apiKey}`, 'x-tnl-tenant': 'attacker_tenant' }),
    );
    assert.deepEqual(actor, { ownerId: 'owner-a', tenantId: 'tnl_public' });
  });

  it('applies dedicated tenant overrides', async () => {
    const identity = new TnlControlAuthenticator({
      directory,
      defaultTenantId: 'tnl_public',
      tenantOverrides: { 'owner-a': 'tenant_dedicated' },
    });
    const actor = await identity.authenticate(request({ authorization: `Bearer ${apiKey}` }));
    assert.equal(actor.tenantId, 'tenant_dedicated');
  });

  it('rejects missing, malformed, and unknown credentials with 401', async () => {
    const identity = new TnlControlAuthenticator({ directory, defaultTenantId: 'tnl_public' });
    for (const headers of [{}, { authorization: 'Basic abc' }, { authorization: 'Bearer nope' }]) {
      await assert.rejects(
        identity.authenticate(request(headers as Record<string, string>)),
        (error: unknown) =>
          error instanceof SubscriptionError &&
          error.status === 401 &&
          error.code === 'authentication_required',
      );
    }
  });

  it('refuses unverified free accounts and denied plans', async () => {
    const identity = new TnlControlAuthenticator({
      directory,
      defaultTenantId: 'tnl_public',
      deniedPlans: ['analyst'],
    });
    await assert.rejects(
      identity.authenticate(request({ authorization: 'Bearer unverified-free-key' })),
      (error: unknown) => error instanceof SubscriptionError && error.status === 403,
    );
    await assert.rejects(
      identity.authenticate(request({ authorization: `Bearer ${apiKey}` })),
      (error: unknown) => error instanceof SubscriptionError && error.code === 'plan_not_entitled',
    );
  });

  it('grants replay only to configured operators', async () => {
    const normal = new TnlControlAuthenticator({ directory, defaultTenantId: 'tnl_public' });
    assert.equal(
      (await normal.authenticate(request({ authorization: `Bearer ${apiKey}` }))).canReplay,
      undefined,
    );
    const operator = new TnlControlAuthenticator({
      directory,
      defaultTenantId: 'tnl_public',
      operatorSubjects: ['owner-a'],
    });
    assert.equal(
      (await operator.authenticate(request({ authorization: `Bearer ${apiKey}` }))).canReplay,
      true,
    );
  });

  it('rate limits a single principal without affecting others', async () => {
    const identity = new TnlControlAuthenticator({
      directory,
      defaultTenantId: 'tnl_public',
      requestsPerMinute: 2,
      now: () => 1_800_000_000_000,
    });
    await identity.authenticate(request({ authorization: `Bearer ${apiKey}` }));
    await identity.authenticate(request({ authorization: `Bearer ${apiKey}` }));
    await assert.rejects(
      identity.authenticate(request({ authorization: `Bearer ${apiKey}` })),
      (error: unknown) =>
        error instanceof SubscriptionError && error.status === 429 && error.code === 'rate_limited',
    );
  });

  it('exposes a member directory adapter that reads the TNL key table', () => {
    assert.equal(typeof MysqlMemberKeyDirectory.connect, 'function');
  });
});
