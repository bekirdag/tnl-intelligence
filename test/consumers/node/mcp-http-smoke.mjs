import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

const url = new URL(required('TNL_MCP_URL'));
const apiKey = required('TNL_API_KEY');
const client = new Client({ name: 'tnl-container-harness', version: '1.0.0' });
const transport = new StreamableHTTPClientTransport(url, {
  requestInit: { headers: { authorization: `Bearer ${apiKey}` } },
});
await client.connect(transport);
try {
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 8);
  const response = await client.callTool({ name: 'tnl_latest_news', arguments: { limit: 2 } });
  assert.deepEqual(
    response.structuredContent.data.data.map((story) => story.id),
    ['story-1', 'story-2'],
  );
} finally {
  await client.close();
}
process.stdout.write(`${JSON.stringify({ ok: true, checks: ['container-mcp-http'] })}\n`);

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}
