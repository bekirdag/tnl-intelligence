import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { afterEach, describe, it } from 'node:test';
import { drainServer } from '../src/shutdown.js';

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections();
          server.close(() => resolve());
        }),
    ),
  );
});

describe('gateway graceful drain', () => {
  it('allows an active request to finish after admission closes', async () => {
    let release: () => void = () => {};
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const server = createServer(async (_request, response) => {
      await blocked;
      response.end('complete');
    });
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const request = fetch(`http://127.0.0.1:${address.port}`);
    await new Promise((resolve) => setTimeout(resolve, 20));
    const draining = drainServer(server, 1_000);
    release();
    assert.equal(await (await request).text(), 'complete');
    assert.equal(await draining, 'drained');
  });

  it('force-closes an active request after the deadline', async () => {
    const server = createServer(() => {});
    await listen(server);
    const address = server.address();
    assert.ok(address && typeof address !== 'string');
    const request = fetch(`http://127.0.0.1:${address.port}`).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 20));
    assert.equal(await drainServer(server, 10), 'forced');
    assert.equal(await request, undefined);
  });
});

async function listen(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  servers.push(server);
}
