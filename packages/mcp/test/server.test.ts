import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TnlClient } from '@theneuralledger/sdk';
import { createTnlMcpServer } from '../src/server.js';

const active: Array<{ close(): Promise<void> }> = [];

afterEach(async () => {
  await Promise.all(active.splice(0).map((item) => item.close()));
});

describe('TNL MCP server', () => {
  it('publishes the expected read-only tools, resources, and prompts', async () => {
    const { client } = await connect(async () => Response.json(newsPage([])));
    const tools = await client.listTools();
    assert.deepEqual(
      tools.tools.map((tool) => tool.name),
      [
        'tnl_latest_news',
        'tnl_search_news',
        'tnl_asset_intelligence',
        'tnl_entity_intelligence',
        'tnl_impact_path',
        'tnl_explain_event',
        'tnl_deep_research',
        'tnl_service_status',
      ],
    );
    assert.ok(tools.tools.every((tool) => tool.annotations?.readOnlyHint === true));
    assert.equal((await client.listResourceTemplates()).resourceTemplates.length, 3);
    assert.equal((await client.listPrompts()).prompts.length, 2);
  });

  it('calls the SDK and returns structured tool output', async () => {
    let request: Request | undefined;
    const { client } = await connect(async (input, init) => {
      request = new Request(input, init);
      return Response.json(newsPage([{ id: 'story-1', title: 'A consequential event' }]));
    });
    const response = await client.callTool({
      name: 'tnl_search_news',
      arguments: { query: 'semiconductors', limit: 5 },
    });
    assert.match(request?.url || '', /\/v1\/search\?/);
    assert.match(request?.url || '', /q=semiconductors/);
    assert.deepEqual(response.structuredContent, {
      data: newsPage([{ id: 'story-1', title: 'A consequential event' }]),
    });
  });
});

async function connect(fetch: typeof globalThis.fetch) {
  const server = createTnlMcpServer({
    client: new TnlClient({ apiKey: 'secret', fetch, retries: 0 }),
  });
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  active.push(client, server);
  return { client, server };
}

function newsPage(data: Array<{ id: string; title?: string }>) {
  return {
    data,
    page: {
      page: 1,
      page_size: 20,
      offset: 0,
      total_count: data.length,
      total_pages: 1,
      has_more: false,
      cursor: null,
      next_cursor: null,
    },
  };
}
