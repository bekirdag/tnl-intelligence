import assert from 'node:assert/strict';
import { chmod, mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { TnlClient } from '@theneuralledger/sdk';
import { runDaemon } from '../src/daemon.js';
import { EventStore } from '../src/store.js';

describe('foreground daemon', () => {
  it('stores immutable revisions once and removes its lock', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tnl-daemon-'));
    const story = {
      id: 'story-1',
      title: 'Material event',
      updatedAt: '2026-07-17T10:00:00.000Z',
    };
    const client = new TnlClient({
      apiKey: 'secret',
      retries: 0,
      fetch: async () => Response.json(newsPage(story)),
    });
    const store = new EventStore(directory);
    await runDaemon({ client, store, intervalMs: 1_000, once: true });
    await runDaemon({ client, store, intervalMs: 1_000, once: true });
    const lines = (await readFile(store.eventsPath, 'utf8')).trim().split('\n');
    assert.equal(lines.length, 1);
    assert.equal(JSON.parse(lines[0] || '{}').story.id, story.id);
    assert.equal((await stat(store.eventsPath)).mode & 0o777, 0o600);
    await assert.rejects(readFile(store.lockPath), /ENOENT/);
  });

  it('reclaims a stale lock', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'tnl-lock-'));
    const store = new EventStore(directory);
    await store.initialize();
    await writeTestFile(store.lockPath, '{"pid":99999999}\n');
    const release = await store.acquireLock();
    await release();
  });
});

async function writeTestFile(path: string, content: string): Promise<void> {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(path, content);
  await chmod(path, 0o600);
}

function newsPage(story: { id: string; title: string; updatedAt: string }) {
  return {
    data: [story],
    page: {
      page: 1,
      page_size: 100,
      offset: 0,
      total_count: 1,
      total_pages: 1,
      has_more: false,
      cursor: null,
      next_cursor: null,
    },
  };
}
