import assert from 'node:assert/strict';
import test from 'node:test';
import { tnlClient, type TnlTransport } from '../src/lib/client';

test('search uses the fixed API endpoint and bounds pagination', async () => {
  const requests: CapturedRequest[] = [];
  const client = tnlClient.create({
    apiKey: 'test-key',
    transport: captureTransport(requests, [{ body: { data: [] } }]),
  });

  const result = await client.searchIntelligence({
    query: '  supply chain  ',
    pageSize: 25,
    cursor: 'next',
    includeBody: true,
  });

  assert.deepEqual(result, { data: [] });
  assert.equal(requests[0]?.method, 'GET');
  assert.equal(requests[0]?.url, 'https://theneuralledger.com/v1/search');
  assert.deepEqual(requests[0]?.queryParams, {
    q: 'supply chain',
    page_size: '25',
    cursor: 'next',
    include: 'sources,claims,body',
  });
  assert.equal(requests[0]?.headers.Authorization, 'Bearer test-key');
});

test('rejects invalid page sizes before network access', async () => {
  let called = false;
  const client = tnlClient.create({
    apiKey: 'test-key',
    transport: async () => {
      called = true;
      throw new Error('unexpected');
    },
  });

  await assert.rejects(
    client.searchIntelligence({ query: 'energy', pageSize: 101 }),
    /page size must be a number from 1 to 100/,
  );
  assert.equal(called, false);
});

test('encodes intelligence and exposure identifiers', async () => {
  const requests: CapturedRequest[] = [];
  const client = tnlClient.create({
    apiKey: 'test-key',
    transport: captureTransport(requests, [{ body: { id: 'story' } }, { body: { data: [] } }]),
  });

  await client.getIntelligence({ id: 'story / one' });
  await client.getExposure({
    kind: 'impact_path',
    value: 'supply / disruption',
  });

  assert.equal(requests[0]?.url, 'https://theneuralledger.com/v1/news/story%20%2F%20one');
  assert.equal(
    requests[1]?.url,
    'https://theneuralledger.com/v1/impact-paths/supply%20%2F%20disruption/stories',
  );
});

test('runs the MCP initialize, notification, tool call, and cleanup sequence', async () => {
  const requests: CapturedRequest[] = [];
  const client = tnlClient.create({
    apiKey: 'test-key',
    transport: captureTransport(requests, [
      {
        headers: { 'mcp-session-id': 'session-1' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 'init', result: {} }),
      },
      { body: '' },
      {
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 'call',
          result: {
            structuredContent: {
              verificationState: 'corroborated',
              sources: ['https://example.com/source'],
            },
          },
        }),
      },
      { body: '' },
    ]),
  });

  const result = await client.runResearch({
    workflow: 'validate-event',
    question: 'Event description',
    from: '2026-07-01T00:00:00Z',
    to: '2026-07-30T00:00:00Z',
    limit: 12,
  });

  assert.equal(result.verificationState, 'corroborated');
  assert.deepEqual(
    requests.map((request) => request.method),
    ['POST', 'POST', 'POST', 'DELETE'],
  );
  assert.equal(requests[2]?.headers['MCP-Session-Id'], 'session-1');
  assert.deepEqual(requests[2]?.body, {
    jsonrpc: '2.0',
    id: 'activepieces-tools-call',
    method: 'tools/call',
    params: {
      name: 'tnl_research_validate_event',
      arguments: {
        event: 'Event description',
        from: '2026-07-01T00:00:00.000Z',
        to: '2026-07-30T00:00:00.000Z',
        limit: 12,
      },
    },
  });
});

test('parses SSE MCP responses', async () => {
  const client = tnlClient.create({
    apiKey: 'test-key',
    transport: captureTransport(
      [],
      [
        {
          headers: { 'mcp-session-id': 'session-2' },
          body: 'event: message\ndata: {"jsonrpc":"2.0","id":"init","result":{}}\n\n',
        },
        { body: '' },
        {
          body: 'event: message\ndata: {"jsonrpc":"2.0","id":"call","result":{"content":[{"type":"text","text":"{\\"summary\\":\\"ok\\"}"}]}}\n\n',
        },
        { body: '' },
      ],
    ),
  });

  const result = await client.runResearch({
    workflow: 'what-changed',
    question: 'What changed?',
  });

  assert.deepEqual(result, { summary: 'ok' });
});

test('sanitizes upstream failures and does not expose the key', async () => {
  const secret = 'tnl_live_secret-value';
  const client = tnlClient.create({
    apiKey: secret,
    transport: async () => {
      throw new Error(`upstream leaked ${secret}`);
    },
  });

  await assert.rejects(client.validateCredentials(), (error: unknown) => {
    assert.ok(error instanceof Error);
    assert.equal(error.message, 'TNL is temporarily unavailable. Try again.');
    assert.equal(error.message.includes(secret), false);
    return true;
  });
});

function captureTransport(
  requests: CapturedRequest[],
  responses: CapturedResponse[],
): TnlTransport {
  return async (request) => {
    requests.push(request);
    const response = responses.shift();
    if (!response) {
      throw new Error('Missing test response');
    }
    return {
      status: response.status ?? 200,
      headers: response.headers ?? {},
      body: response.body,
    };
  };
}

type CapturedRequest = Parameters<TnlTransport>[0];
type CapturedResponse = {
  status?: number;
  headers?: Record<string, string>;
  body: unknown;
};
