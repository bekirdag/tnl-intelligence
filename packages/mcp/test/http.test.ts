import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { afterEach, describe, it } from 'node:test';
import { createServer, type Server } from 'node:http';
import { createHttpServer } from '../src/http.js';

const servers: Server[] = [];
const clients: Client[] = [];

afterEach(async () => {
  await Promise.all(clients.splice(0).map((client) => client.close()));
  await Promise.all(
    servers
      .splice(0)
      .map((server) => new Promise<void>((resolve) => server.close(() => resolve()))),
  );
});

describe('MCP HTTP transport', () => {
  it('exposes health and protects MCP with an API key', async () => {
    const server = await listen(createHttpServer());
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const baseUrl = `http://127.0.0.1:${address.port}`;
    assert.deepEqual(await (await fetch(`${baseUrl}/healthz`)).json(), {
      ok: true,
      service: 'tnl-intelligence-mcp',
    });
    const unauthorized = await fetch(`${baseUrl}/mcp`, { method: 'POST' });
    assert.equal(unauthorized.status, 401);
  });

  it('completes an HTTP initialize and tool call against a TNL upstream', async () => {
    let upstreamAuthorization: string | undefined;
    const upstream = await listen(
      createServer((request, response) => {
        upstreamAuthorization = request.headers.authorization;
        response
          .writeHead(200, { 'content-type': 'application/json' })
          .end(JSON.stringify(newsPage()));
      }),
    );
    const upstreamAddress = upstream.address();
    assert.ok(upstreamAddress && typeof upstreamAddress !== 'string');
    const server = await listen(
      createHttpServer({ baseUrl: `http://127.0.0.1:${upstreamAddress.port}` }),
    );
    const address = server.address();
    assert.ok(address && typeof address !== 'string');

    const client = new Client({ name: 'http-test', version: '1.0.0' });
    clients.push(client);
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${address.port}/mcp`),
      { requestInit: { headers: { authorization: 'Bearer member-key' } } },
    );
    await client.connect(transport as unknown as Parameters<typeof client.connect>[0]);
    const response = await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 5 } });
    assert.equal(upstreamAuthorization, 'Bearer member-key');
    assert.deepEqual(response.structuredContent, { data: newsPage() });
  });
});

async function listen(server: Server): Promise<Server> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
  return server;
}

function newsPage() {
  return {
    data: [{ id: 'story-1', title: 'Material event' }],
    page: {
      page: 1,
      page_size: 5,
      offset: 0,
      total_count: 1,
      total_pages: 1,
      has_more: false,
      cursor: null,
      next_cursor: null,
    },
  };
}
