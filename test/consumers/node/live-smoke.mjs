import assert from 'node:assert/strict';
import { TnlClient } from '@theneuralledger/sdk';

const apiKey = required('TNL_API_KEY');
const baseUrl = process.env.TNL_BASE_URL || 'https://theneuralledger.com';
const client = new TnlClient({ apiKey, baseUrl, retries: 0, timeoutMs: 15_000 });
const [page, account] = await Promise.all([client.listNews({ pageSize: 1 }), client.getAccount()]);
assert.ok(Array.isArray(page.data));
assert.equal(typeof account, 'object');
process.stdout.write(
  `${JSON.stringify({ ok: true, requestCount: 2, returned: page.data.length, requestId: null })}\n`,
);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
