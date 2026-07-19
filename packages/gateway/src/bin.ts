#!/usr/bin/env node
import { configFromEnvironment } from './config.js';
import { createGatewayServer } from './server.js';
import { drainServer } from './shutdown.js';

const config = configFromEnvironment();
const server = createGatewayServer(config.server);
await new Promise<void>((resolve, reject) => {
  server.once('error', reject);
  server.listen(config.port, config.host, resolve);
});
process.stderr.write(`TNL MCP gateway listening on ${config.host}:${config.port}\n`);

let stopping = false;
const shutdown = async (): Promise<void> => {
  if (stopping) return;
  stopping = true;
  try {
    const state = await drainServer(server);
    if (state === 'forced') {
      process.stderr.write('TNL MCP gateway shutdown exceeded the drain deadline\n');
      process.exitCode = 1;
    }
  } catch {
    process.stderr.write('TNL MCP gateway shutdown failed\n');
    process.exitCode = 1;
  }
};

process.once('SIGTERM', () => void shutdown());
process.once('SIGINT', () => void shutdown());
