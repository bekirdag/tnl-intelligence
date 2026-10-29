import test from 'node:test';
import assert from 'node:assert/strict';
import { MysqlMemberKeyDirectory } from '../src/production/identity.js';

test('webhook key directory enforces expiry on every authentication lookup', async () => {
  let expiry: unknown = undefined;
  let calls = 0;
  const pool = {
    execute: async (_sql: string, values: string[]) => {
      assert.deepEqual(values, ['key-hash']); calls++;
      return [[{ id: 'codali-test', owner_sub: 'codali', plan_slug: 'free', email_verified_at: '2026-10-29', expires_at: expiry }], null];
    },
    query: async () => [], end: async () => {},
  };
  // Inject only the database boundary; exercise the production lookup itself.
  const Directory = MysqlMemberKeyDirectory as unknown as new (pool: unknown) => MysqlMemberKeyDirectory;
  const directory = new Directory(pool);
  for (expiry of [undefined, null, new Date('2056-10-29T00:00:00Z'), '2056-10-29 00:00:00.000', '2056-10-29T00:00:00Z']) assert.ok(await directory.findByHash('key-hash'));
  for (expiry of ['2000-01-01T00:00:00Z', new Date('2000-01-01T00:00:00Z'), new Date(NaN), '', 'invalid', '2056-02-31T00:00:00Z', '2056-10-29T00:00:00']) assert.equal(await directory.findByHash('key-hash'), undefined);
  assert.equal(calls, 12); await directory.close();
});
