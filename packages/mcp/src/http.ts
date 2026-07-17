import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { TnlClient } from '@theneuralledger/sdk';
import { createTnlMcpServer } from './server.js';

export interface HttpOptions {
  host?: string;
  port?: number;
  apiKey?: string;
  baseUrl?: string;
}

export function createHttpServer(options: HttpOptions = {}): Server {
  return createServer(async (request, response) => {
    try {
      if (request.url === '/healthz' && request.method === 'GET') {
        json(response, 200, { ok: true, service: 'tnl-intelligence-mcp' });
        return;
      }
      if (request.url !== '/mcp') {
        json(response, 404, { error: 'not_found' });
        return;
      }
      if (request.method !== 'POST') {
        jsonRpcError(response, 405, -32000, 'Method not allowed');
        return;
      }
      const apiKey = bearerToken(request) || options.apiKey || process.env.TNL_API_KEY;
      if (!apiKey) {
        jsonRpcError(response, 401, -32001, 'Bearer API key or TNL_API_KEY is required');
        return;
      }
      const baseUrl = options.baseUrl || process.env.TNL_BASE_URL;
      const client = new TnlClient({
        apiKey,
        ...(baseUrl ? { baseUrl } : {}),
      });
      const server = createTnlMcpServer({ client });
      const transport = new StreamableHTTPServerTransport({ enableJsonResponse: true });
      response.on('close', () => {
        void transport.close();
        void server.close();
      });
      // The MCP SDK's Node transport declaration is not exact-optional compatible.
      await server.connect(transport as unknown as Parameters<typeof server.connect>[0]);
      await transport.handleRequest(request, response);
    } catch (error) {
      if (!response.headersSent) {
        jsonRpcError(
          response,
          500,
          -32603,
          error instanceof Error ? error.message : 'Internal error',
        );
      }
    }
  });
}

export async function listenHttp(options: HttpOptions = {}): Promise<Server> {
  const host = options.host || process.env.TNL_MCP_HOST || '127.0.0.1';
  const port = options.port ?? numberFromEnv('TNL_MCP_PORT', 7317);
  const server = createHttpServer(options);
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, host, () => resolve());
  });
  return server;
}

function bearerToken(request: IncomingMessage): string | undefined {
  const authorization = request.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || undefined;
}

function numberFromEnv(name: string, fallback: number): number {
  const value = process.env[name];
  if (!value) return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > 65_535) {
    throw new Error(`${name} must be an integer from 0 to 65535`);
  }
  return parsed;
}

function json(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(body));
}

function jsonRpcError(
  response: ServerResponse,
  status: number,
  code: number,
  message: string,
): void {
  json(response, status, { jsonrpc: '2.0', error: { code, message }, id: null });
}
