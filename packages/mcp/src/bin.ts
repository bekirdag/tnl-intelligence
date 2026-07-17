#!/usr/bin/env node
import { listenHttp } from './http.js';
import { runStdio } from './stdio.js';

const mode = process.argv[2] || 'stdio';

if (mode === 'stdio') {
  await runStdio();
} else if (mode === 'http' || mode === 'serve') {
  const server = await listenHttp();
  const address = server.address();
  console.error(
    `TNL MCP listening on ${typeof address === 'string' ? address : `${address?.address}:${address?.port}`}`,
  );
} else {
  throw new Error('Usage: tnl-mcp [stdio|http]');
}
