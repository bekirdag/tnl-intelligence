import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { TnlClient } from '@theneuralledger/sdk';
import {
  DETERMINISTIC_RESEARCH_EVIDENCE,
  DeterministicCodaliAdapter,
  DeterministicEvidenceAdapter,
  ResearchOrchestrator,
  type ResearchTask,
} from '@theneuralledger/research';
import { createTnlMcpServer, TNL_RESEARCH_TOOL_NAMES } from '../src/index.js';

const active: Array<{ client: Client; server: ReturnType<typeof createTnlMcpServer> }> = [];
afterEach(async () => {
  await Promise.all(
    active
      .splice(0)
      .map(async ({ client, server }) => Promise.all([client.close(), server.close()])),
  );
});

describe('research MCP surface', () => {
  it('registers six typed research tools and a rich UI resource when configured', async () => {
    const runner = researchRunner();
    const server = createTnlMcpServer({
      client: new TnlClient({
        apiKey: 'fixture-key',
        fetch: async () => Response.json({ data: [], page: { total_count: 0 } }),
      }),
      research: runner,
    });
    const client = new Client({ name: 'research-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    active.push({ client, server });

    const tools = await client.listTools();
    for (const name of TNL_RESEARCH_TOOL_NAMES)
      assert.ok(tools.tools.some((tool) => tool.name === name));
    const response = await client.callTool({
      name: 'tnl_research_weekly_consequential',
      arguments: {
        question: 'What mattered most this week?',
        from: '2026-07-11T00:00:00.000Z',
        to: '2026-07-18T12:00:00.000Z',
        asOf: '2026-07-18T12:00:00.000Z',
      },
    });
    const structured = response.structuredContent as {
      data: { automatedAuthor: { name: string }; claims: unknown[] };
    };
    assert.equal(structured.data.automatedAuthor.name, 'TNL Bot');
    assert.ok(structured.data.claims.length > 0);

    const resources = await client.listResources();
    assert.ok(
      resources.resources.some((resource) => resource.uri === 'ui://tnl/research-workspace'),
    );
    const app = await client.readResource({ uri: 'ui://tnl/research-workspace' });
    assert.match(String(app.contents[0]?.text), /TNL Research/);
  });

  it('does not expose research capabilities without a runner or when excluded by policy', async () => {
    const server = createTnlMcpServer({
      client: new TnlClient({
        apiKey: 'fixture-key',
        fetch: async () => Response.json({ data: [], page: { total_count: 0 } }),
      }),
    });
    const client = new Client({ name: 'research-disabled-test', version: '1.0.0' });
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    active.push({ client, server });
    const tools = await client.listTools();
    assert.ok(
      TNL_RESEARCH_TOOL_NAMES.every((name) => !tools.tools.some((tool) => tool.name === name)),
    );
  });
});

function researchRunner() {
  const orchestrator = new ResearchOrchestrator({
    adapters: (['tnl', 'docdex', 'web'] as const).map(
      (tool) => new DeterministicEvidenceAdapter(tool, DETERMINISTIC_RESEARCH_EVIDENCE),
    ),
    codali: new DeterministicCodaliAdapter(),
    now: () => new Date('2026-07-18T12:00:00.000Z'),
  });
  return {
    run: (task: ResearchTask) =>
      orchestrator.run({ tenantId: 'tenant-mcp', actorId: 'actor-mcp' }, task),
  };
}
