import type { TnlClient, TnlStory } from '@theneuralledger/sdk';
import { type EventRecord, EventStore, storyFingerprint } from './store.js';

const MAX_FINGERPRINTS = 20_000;

export interface SyncOptions {
  client: TnlClient;
  store: EventStore;
  writeStatus?: (line: string) => void;
  onStories?: (stories: TnlStory[]) => void | Promise<void>;
}

export interface DaemonOptions extends SyncOptions {
  intervalMs: number;
  signal?: AbortSignal;
  once?: boolean;
}

export async function syncOnce(options: SyncOptions): Promise<number> {
  const writeStatus = options.writeStatus || (() => undefined);
  writeStatus('1. Running: reading local state');
  const state = await options.store.readState();
  writeStatus('1. Complete: local state loaded');

  writeStatus('2. Running: fetching incremental TNL intelligence');
  const stories: TnlStory[] = [];
  let cursor: string | undefined;
  do {
    const page = await options.client.listNews({
      pageSize: 100,
      sort: 'pipeline',
      ...(state.updatedSince ? { updatedSince: state.updatedSince } : {}),
      ...(cursor ? { cursor } : {}),
    });
    stories.push(...page.data);
    cursor = page.page.next_cursor || undefined;
  } while (cursor);
  writeStatus(`2. Complete: fetched ${stories.length} stories`);

  writeStatus('3. Running: deduplicating story revisions');
  const known = new Set(state.fingerprints);
  const records: EventRecord[] = [];
  for (const story of stories) {
    const fingerprint = storyFingerprint(story);
    if (known.has(fingerprint)) continue;
    known.add(fingerprint);
    records.push({ observedAt: new Date().toISOString(), fingerprint, story });
  }
  writeStatus(`3. Complete: ${records.length} new revisions`);

  writeStatus('4. Running: committing cache and cursor state');
  await options.store.append(records);
  const latestTimestamp =
    newestTimestamp(stories) || state.updatedSince || new Date().toISOString();
  await options.store.writeState({
    updatedSince: latestTimestamp,
    fingerprints: [...known].slice(-MAX_FINGERPRINTS),
  });
  writeStatus('4. Complete: cache and state committed');
  if (records.length > 0) await options.onStories?.(records.map((record) => record.story));
  return records.length;
}

export async function runDaemon(options: DaemonOptions): Promise<void> {
  if (!Number.isFinite(options.intervalMs) || options.intervalMs < 1_000) {
    throw new TypeError('Polling interval must be at least 1000ms');
  }
  const releaseLock = await options.store.acquireLock();
  try {
    do {
      await syncOnce(options);
      if (options.once || options.signal?.aborted) return;
      await wait(options.intervalMs, options.signal);
    } while (!options.signal?.aborted);
  } finally {
    await releaseLock();
  }
}

function newestTimestamp(stories: TnlStory[]): string | undefined {
  return stories
    .flatMap((story) => [story.updatedAt, story.publishedAt, story.date])
    .filter(
      (value): value is string => typeof value === 'string' && !Number.isNaN(Date.parse(value)),
    )
    .sort((left, right) => Date.parse(right) - Date.parse(left))[0];
}

async function wait(milliseconds: number, signal?: AbortSignal): Promise<void> {
  await new Promise<void>((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(resolve, milliseconds);
    signal?.addEventListener(
      'abort',
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}
