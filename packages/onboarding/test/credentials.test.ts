import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  CredentialError,
  CredentialService,
  InMemoryCredentialStore,
  MemoryCredentialAuditSink,
  type CredentialActor,
} from '../src/credentials.js';

describe('developer credential service', () => {
  it('shows a strong secret once and persists only a salted verifier', async () => {
    const { service, store, audit } = setup();
    const issued = await service.create(actor(), {
      name: 'Research workstation',
      scopes: ['news:read', 'research:read'],
      lifetimeDays: 30,
    });
    assert.match(issued.secret, /^tnl_dev_[a-f0-9]{12}\.[A-Za-z0-9_-]{40,}$/);
    const persisted = [...store.records.values()][0]!;
    assert.ok(persisted.verifier);
    assert.ok(persisted.salt);
    assert.ok(!JSON.stringify(persisted).includes(issued.secret));
    assert.ok(!JSON.stringify(audit.events).includes(issued.secret));
    assert.ok(!JSON.stringify(await service.list(actor())).includes('verifier'));
    assert.equal((await service.authenticate(issued.secret)).id, issued.credential.id);
  });

  it('rotates atomically, invalidates the predecessor, and revokes the replacement', async () => {
    const { service } = setup();
    const original = await service.create(actor(), { name: 'Agent', scopes: ['mcp:read'] });
    const replacement = await service.rotate(actor(), original.credential.id);
    assert.notEqual(replacement.secret, original.secret);
    await assert.rejects(() => service.authenticate(original.secret), invalidKey);
    assert.equal((await service.authenticate(replacement.secret)).status, 'active');
    const revoked = await service.revoke(actor(), replacement.credential.id);
    assert.equal(revoked.status, 'revoked');
    await assert.rejects(() => service.authenticate(replacement.secret), invalidKey);
  });

  it('requires recent authentication and enforces owner and tenant isolation', async () => {
    const { service } = setup();
    const issued = await service.create(actor(), { name: 'CLI', scopes: ['news:read'] });
    await assert.rejects(
      () => service.revoke({ ...actor(), recentAuthenticationAt: 1 }, issued.credential.id),
      (error: unknown) =>
        error instanceof CredentialError && error.code === 'recent_authentication_required',
    );
    await assert.rejects(
      () => service.revoke({ ...actor(), tenantId: 'other-tenant' }, issued.credential.id),
      (error: unknown) => error instanceof CredentialError && error.code === 'not_found',
    );
  });

  it('bounds active keys, daily creation, lifetime, and account deletion', async () => {
    const { service, store } = setup({ maxActiveKeys: 2, maxCreatesPerDay: 2 });
    await service.create(actor(), { name: 'One', scopes: ['news:read'], lifetimeDays: 999 });
    const second = await service.create(actor(), { name: 'Two', scopes: ['news:read'] });
    await assert.rejects(
      () => service.create(actor(), { name: 'Three', scopes: ['news:read'] }),
      (error: unknown) => error instanceof CredentialError && error.code === 'key_limit',
    );
    assert.ok(Date.parse(second.credential.expiresAt) <= Date.UTC(2026, 9, 16));
    await service.deleteAccount(actor());
    assert.equal(store.records.size, 0);
    await assert.rejects(
      () => service.create(actor(), { name: 'Deleted-account reset', scopes: ['news:read'] }),
      (error: unknown) => error instanceof CredentialError && error.code === 'create_rate',
    );
  });
});

function setup(policy: { maxActiveKeys?: number; maxCreatesPerDay?: number } = {}) {
  const store = new InMemoryCredentialStore();
  const audit = new MemoryCredentialAuditSink();
  const service = new CredentialService({
    store,
    audit,
    policy,
    now: () => Date.UTC(2026, 6, 18, 12),
  });
  return { service, store, audit };
}

function actor(): CredentialActor {
  return {
    ownerId: 'user-1',
    tenantId: 'tenant-1',
    recentAuthenticationAt: Date.UTC(2026, 6, 18, 11, 59),
  };
}

function invalidKey(error: unknown): boolean {
  return error instanceof CredentialError && error.code === 'invalid_key';
}
