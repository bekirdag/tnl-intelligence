import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  TnlAuthenticationError,
  TnlClient,
  TnlRateLimitError,
  TnlTimeoutError,
} from '../src/index.js';

describe('TnlClient', () => {
  it('maps typed query parameters and authenticates without exposing the key', async () => {
    const requests: Request[] = [];
    const client = new TnlClient({
      apiKey: 'secret-key',
      retries: 0,
      fetch: async (input, init) => {
        requests.push(new Request(input, init));
        return Response.json({
          data: [],
          page: {
            page: 1,
            page_size: 10,
            offset: 0,
            total_count: 0,
            total_pages: 0,
            has_more: false,
            cursor: null,
            next_cursor: null,
          },
        });
      },
    });

    await client.listNews({
      pageSize: 10,
      fields: ['id', 'title'],
      impactPath: 'oil',
      updatedSince: '2026-07-17T00:00:00Z',
    });

    assert.equal(requests.length, 1);
    const request = requests[0]!;
    assert.equal(request.headers.get('authorization'), 'Bearer secret-key');
    assert.match(request.url, /page_size=10/);
    assert.match(request.url, /fields=id%2Ctitle/);
    assert.match(request.url, /impact_path=oil/);
    assert.doesNotMatch(JSON.stringify(client), /secret-key/);
  });

  it('iterates cursor pages once', async () => {
    let call = 0;
    const client = new TnlClient({
      apiKey: 'key',
      retries: 0,
      fetch: async () => {
        call += 1;
        const hasMore = call === 1;
        return Response.json({
          data: [{ id: `story-${call}` }],
          page: {
            page: call,
            page_size: 1,
            offset: call - 1,
            total_count: 2,
            total_pages: 2,
            has_more: hasMore,
            cursor: null,
            next_cursor: hasMore ? 'next' : null,
          },
        });
      },
    });

    const ids: string[] = [];
    for await (const story of client.iterateNews({ pageSize: 1 })) ids.push(story.id);
    assert.deepEqual(ids, ['story-1', 'story-2']);
  });

  it('uses typed authentication and quota errors', async () => {
    const unauthorized = new TnlClient({
      apiKey: 'key',
      retries: 0,
      fetch: async () =>
        Response.json(
          { error: { code: 'unauthorized', message: 'Invalid API key' } },
          { status: 401 },
        ),
    });
    await assert.rejects(() => unauthorized.getAccount(), TnlAuthenticationError);

    const limited = new TnlClient({
      apiKey: 'key',
      retries: 0,
      fetch: async () =>
        Response.json(
          { error: { code: 'rate_limit_exceeded', message: 'Monthly limit reached' } },
          { status: 429, headers: { 'retry-after': '60' } },
        ),
    });
    await assert.rejects(
      () => limited.listNews(),
      (error: unknown) =>
        error instanceof TnlRateLimitError &&
        error.code === 'rate_limit_exceeded' &&
        error.retryAfterSeconds === 60,
    );
  });

  it('retries transient upstream errors', async () => {
    let attempts = 0;
    const client = new TnlClient({
      apiKey: 'key',
      retries: 1,
      fetch: async () => {
        attempts += 1;
        return attempts === 1
          ? Response.json({ message: 'retry' }, { status: 503 })
          : Response.json({ categories: [], countries: [] });
      },
    });
    await client.getFilters();
    assert.equal(attempts, 2);
  });

  it('converts internal request deadlines into timeout errors', async () => {
    const client = new TnlClient({
      apiKey: 'key',
      retries: 0,
      timeoutMs: 5,
      fetch: async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('aborted', 'AbortError')),
            { once: true },
          );
        }),
    });
    await assert.rejects(() => client.getMarkets(), TnlTimeoutError);
  });
});
