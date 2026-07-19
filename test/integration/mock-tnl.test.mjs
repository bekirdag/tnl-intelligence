import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { FORBIDDEN_API_KEY, TEST_API_KEY, startMockTnl } from '../mock-tnl/server.mjs';

const active = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((mock) => mock.close()));
});

describe('mock TNL API', () => {
  it('is deterministic, paginated, revision-aware, and secret-safe', async () => {
    const mock = await startMockTnl();
    active.push(mock);
    const first = await api(mock.baseUrl, '/v1/news');
    assert.equal(first.status, 200);
    const firstPage = await first.json();
    assert.deepEqual(
      firstPage.data.map((story) => story.id),
      ['story-1', 'story-2'],
    );
    assert.equal(firstPage.page.next_cursor, 'fixture-page-2');

    const second = await api(mock.baseUrl, '/v1/news?cursor=fixture-page-2');
    assert.deepEqual(
      (await second.json()).data.map((story) => story.id),
      ['story-3'],
    );

    await fetch(`${mock.baseUrl}/__control`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ revision: 2 }),
    });
    const revised = await api(mock.baseUrl, '/v1/news/story-1');
    assert.match((await revised.json()).title, /revision 2/);
    assert.equal(
      mock.state.requests.some((request) => 'token' in request),
      false,
    );
  });

  it('provides the planned authorization and failure scenarios', async () => {
    const mock = await startMockTnl({ slowDelayMs: 30 });
    active.push(mock);
    assert.equal((await fetch(`${mock.baseUrl}/v1/news`)).status, 401);
    assert.equal((await api(mock.baseUrl, '/v1/news', FORBIDDEN_API_KEY)).status, 403);
    assert.equal((await api(mock.baseUrl, '/v1/news/missing')).status, 404);
    assert.equal((await api(mock.baseUrl, '/v1/news/conflict')).status, 409);
    assert.equal((await api(mock.baseUrl, '/v1/search?q=scenario%3A429')).status, 429);
    assert.equal((await api(mock.baseUrl, '/v1/search?q=scenario%3A500')).status, 500);
    assert.equal((await api(mock.baseUrl, '/v1/search?q=scenario%3Aslow')).status, 200);
    const malformed = await api(mock.baseUrl, '/v1/search?q=scenario%3Amalformed');
    await assert.rejects(malformed.json());
  });
});

function api(baseUrl, path, key = TEST_API_KEY) {
  return fetch(`${baseUrl}${path}`, { headers: { authorization: `Bearer ${key}` } });
}
