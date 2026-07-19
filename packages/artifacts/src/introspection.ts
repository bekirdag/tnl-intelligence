import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { LATEST_PROTOCOL_VERSION } from '@modelcontextprotocol/sdk/types.js';
import { createTnlMcpServer } from '@theneuralledger/mcp';
import { TnlClient } from '@theneuralledger/sdk';
import type { CapabilityInventory, CapabilityItem, CapabilityTool } from './contracts.js';

export async function introspectPackagedCapabilities(): Promise<CapabilityInventory> {
  const server = createTnlMcpServer({
    client: new TnlClient({
      apiKey: 'introspection-placeholder',
      retries: 0,
      fetch: async () => Response.json({ data: [] }),
    }),
  });
  const client = new Client({ name: 'tnl-artifact-generator', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const [tools, resources, templates, prompts] = await Promise.all([
      client.listTools(),
      client.listResources(),
      client.listResourceTemplates(),
      client.listPrompts(),
    ]);
    const version = client.getServerVersion();
    if (!version) throw new TypeError('MCP server did not expose version metadata');
    return {
      generatedFrom: 'runtime-introspection',
      protocolVersion: LATEST_PROTOCOL_VERSION,
      server: { name: version.name, version: version.version },
      tools: tools.tools.map(
        (tool): CapabilityTool => ({
          name: tool.name,
          ...(tool.title ? { title: tool.title } : {}),
          ...(tool.description ? { description: tool.description } : {}),
          ...(tool.annotations
            ? { annotations: tool.annotations as Readonly<Record<string, unknown>> }
            : {}),
        }),
      ),
      resources: resources.resources.map(
        (resource): CapabilityItem => ({
          name: resource.name,
          ...(resource.title ? { title: resource.title } : {}),
          ...(resource.description ? { description: resource.description } : {}),
          uri: resource.uri,
        }),
      ),
      resourceTemplates: templates.resourceTemplates.map(
        (resource): CapabilityItem => ({
          name: resource.name,
          ...(resource.title ? { title: resource.title } : {}),
          ...(resource.description ? { description: resource.description } : {}),
          uriTemplate: resource.uriTemplate,
        }),
      ),
      prompts: prompts.prompts.map(
        (prompt): CapabilityItem => ({
          name: prompt.name,
          ...(prompt.title ? { title: prompt.title } : {}),
          ...(prompt.description ? { description: prompt.description } : {}),
        }),
      ),
    };
  } finally {
    await Promise.allSettled([client.close(), server.close()]);
  }
}
