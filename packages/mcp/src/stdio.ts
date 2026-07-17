import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { TnlClient, type TnlClientOptions } from '@theneuralledger/sdk';
import { createTnlMcpServer } from './server.js';

export interface StdioOptions extends Omit<TnlClientOptions, 'apiKey'> {
  apiKey?: string;
}

export async function runStdio(options: StdioOptions = {}): Promise<void> {
  const apiKey = options.apiKey || process.env.TNL_API_KEY;
  if (!apiKey) throw new Error('TNL_API_KEY is required');
  const baseUrl = options.baseUrl || process.env.TNL_BASE_URL;
  const client = new TnlClient({
    ...options,
    apiKey,
    ...(baseUrl ? { baseUrl } : {}),
  });
  const server = createTnlMcpServer({ client });
  await server.connect(new StdioServerTransport());
}
