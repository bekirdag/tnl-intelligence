import { createHash } from 'node:crypto';
import { appendFile, chmod, mkdir, open, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { TnlStory } from '@theneuralledger/sdk';

export interface DaemonState {
  updatedSince: string | null;
  fingerprints: string[];
}

export interface EventRecord {
  observedAt: string;
  fingerprint: string;
  story: TnlStory;
}

export class EventStore {
  readonly directory: string;
  readonly eventsPath: string;
  readonly statePath: string;
  readonly lockPath: string;

  constructor(directory = defaultStateDirectory()) {
    this.directory = resolve(directory);
    this.eventsPath = join(this.directory, 'events.jsonl');
    this.statePath = join(this.directory, 'state.json');
    this.lockPath = join(this.directory, 'daemon.lock');
  }

  async initialize(): Promise<void> {
    await mkdir(this.directory, { recursive: true, mode: 0o700 });
    await chmod(this.directory, 0o700);
  }

  async readState(): Promise<DaemonState> {
    await this.initialize();
    try {
      const parsed = JSON.parse(await readFile(this.statePath, 'utf8')) as Partial<DaemonState>;
      return {
        updatedSince: typeof parsed.updatedSince === 'string' ? parsed.updatedSince : null,
        fingerprints: Array.isArray(parsed.fingerprints)
          ? parsed.fingerprints.filter((value): value is string => typeof value === 'string')
          : [],
      };
    } catch (error) {
      if (isNotFound(error)) return { updatedSince: null, fingerprints: [] };
      throw error;
    }
  }

  async append(records: EventRecord[]): Promise<void> {
    if (records.length === 0) return;
    await this.initialize();
    const payload = records.map((record) => JSON.stringify(record)).join('\n') + '\n';
    await appendFile(this.eventsPath, payload, { encoding: 'utf8', mode: 0o600 });
    await chmod(this.eventsPath, 0o600);
  }

  async writeState(state: DaemonState): Promise<void> {
    await this.initialize();
    const temporary = join(
      dirname(this.statePath),
      `.state-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.tmp`,
    );
    await writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, this.statePath);
    await chmod(this.statePath, 0o600);
  }

  async acquireLock(): Promise<() => Promise<void>> {
    await this.initialize();
    await this.removeStaleLock();
    let handle;
    try {
      handle = await open(this.lockPath, 'wx', 0o600);
    } catch (error) {
      if (hasCode(error, 'EEXIST'))
        throw new Error(`A TNL daemon is already using ${this.directory}`);
      throw error;
    }
    await handle.writeFile(
      `${JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() })}\n`,
    );
    await handle.close();
    return async () => {
      await rm(this.lockPath, { force: true });
    };
  }

  private async removeStaleLock(): Promise<void> {
    try {
      const value = JSON.parse(await readFile(this.lockPath, 'utf8')) as { pid?: unknown };
      if (typeof value.pid === 'number' && processExists(value.pid)) return;
      await rm(this.lockPath, { force: true });
    } catch (error) {
      if (isNotFound(error)) return;
      if (error instanceof SyntaxError) {
        await rm(this.lockPath, { force: true });
        return;
      }
      throw error;
    }
  }
}

export function storyFingerprint(story: TnlStory): string {
  return createHash('sha256')
    .update(
      JSON.stringify({
        id: story.id,
        updatedAt: story.updatedAt || null,
        publishedAt: story.publishedAt || story.date || null,
        title: story.title || null,
        verificationState: story.verificationState || null,
        claims: story.claims || null,
        sources: story.sources || null,
      }),
    )
    .digest('hex');
}

export function defaultStateDirectory(environment = process.env): string {
  return environment.TNL_STATE_DIR || join(homedir(), '.tnl-intelligence');
}

function processExists(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return hasCode(error, 'EPERM');
  }
}

function isNotFound(error: unknown): boolean {
  return hasCode(error, 'ENOENT');
}

function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}
