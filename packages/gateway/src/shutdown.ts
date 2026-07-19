import type { Server } from 'node:http';

export async function drainServer(
  server: Server,
  timeoutMs = 10_000,
): Promise<'drained' | 'forced'> {
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1) {
    throw new TypeError('shutdown timeout must be a positive integer');
  }
  return new Promise((resolve, reject) => {
    let forced = false;
    let settled = false;
    const timeout = setTimeout(() => {
      forced = true;
      server.closeAllConnections();
    }, timeoutMs);
    const idleSweep = setInterval(
      () => server.closeIdleConnections(),
      Math.min(100, Math.max(10, Math.floor(timeoutMs / 10))),
    );
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      clearInterval(idleSweep);
      if (error) reject(error);
      else resolve(forced ? 'forced' : 'drained');
    };
    server.close((error) => finish(error));
    server.closeIdleConnections();
  });
}
