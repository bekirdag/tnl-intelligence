import { Command, InvalidArgumentError } from 'commander';
import { listenHttp, runStdio } from '@theneuralledger/mcp';
import type { TnlClient } from '@theneuralledger/sdk';
import { clientFromEnvironment } from './client.js';
import { runDaemon } from './daemon.js';
import { writeJson, writeStories, type Writer } from './output.js';
import { EventStore, defaultStateDirectory } from './store.js';

export interface ProgramOptions {
  clientFactory?: () => TnlClient;
  stdout?: Writer;
  stderr?: Writer;
}

export function createProgram(options: ProgramOptions = {}): Command {
  const clientFactory = options.clientFactory || clientFromEnvironment;
  const stdout = options.stdout || ((text: string) => process.stdout.write(text));
  const stderr = options.stderr || ((text: string) => process.stderr.write(text));
  const program = new Command()
    .name('tnl')
    .description('The Neural Ledger intelligence CLI and foreground daemon')
    .version('0.1.0');

  program
    .command('latest')
    .description('Show the latest intelligence')
    .option('-n, --limit <number>', 'number of stories', integer(1, 100), 20)
    .option('--json', 'emit the complete JSON response')
    .action(async ({ limit, json }: { limit: number; json?: boolean }) => {
      const page = await clientFactory().listNews({ pageSize: limit });
      json ? writeJson(stdout, page) : writeStories(stdout, page);
    });

  program
    .command('search')
    .description('Search TNL intelligence')
    .argument('<query>', 'natural-language or keyword query')
    .option('-n, --limit <number>', 'number of stories', integer(1, 100), 20)
    .option('--json', 'emit the complete JSON response')
    .action(async (query: string, { limit, json }: { limit: number; json?: boolean }) => {
      const page = await clientFactory().searchNews({ query, pageSize: limit });
      json ? writeJson(stdout, page) : writeStories(stdout, page);
    });

  program
    .command('asset')
    .description('Show intelligence linked to an asset ticker')
    .argument('<ticker>', 'asset ticker')
    .option('-n, --limit <number>', 'number of stories', integer(1, 100), 20)
    .option('--json', 'emit the complete JSON response')
    .action(async (ticker: string, { limit, json }: { limit: number; json?: boolean }) => {
      const page = await clientFactory().getAssetStories(ticker, { pageSize: limit });
      json ? writeJson(stdout, page) : writeStories(stdout, page);
    });

  program
    .command('status')
    .description('Check API access, usage, and data freshness')
    .option('--json', 'emit JSON')
    .action(async ({ json }: { json?: boolean }) => {
      const client = clientFactory();
      const [account, markets] = await Promise.all([client.getAccount(), client.getMarkets()]);
      const status = {
        ok: true,
        plan: account.plan ?? null,
        usage: account.usage ?? null,
        markets: {
          quoteCount: markets.data.length,
          lastSyncAt: markets.lastSyncAt ?? null,
          lastError: markets.lastError ?? null,
        },
        rateLimit: client.lastRateLimit,
      };
      if (json) writeJson(stdout, status);
      else {
        stdout('TNL API access: healthy\n');
        stdout(`Market context last sync: ${markets.lastSyncAt || 'unknown'}\n`);
      }
    });

  addPollCommand(
    program,
    'watch',
    'Watch and print new story revisions',
    clientFactory,
    stdout,
    stderr,
    true,
  );
  addPollCommand(
    program,
    'daemon',
    'Run the append-only intelligence cache in the foreground',
    clientFactory,
    stdout,
    stderr,
    false,
  );

  program
    .command('mcp')
    .description('Run the MCP server over stdio')
    .action(async () => runStdio());

  program
    .command('serve')
    .description('Run the MCP server over Streamable HTTP')
    .option('--host <host>', 'bind host', '127.0.0.1')
    .option('--port <port>', 'bind port', integer(0, 65_535), 7317)
    .action(async ({ host, port }: { host: string; port: number }) => {
      const server = await listenHttp({ host, port });
      const address = server.address();
      stderr(
        `TNL MCP listening on ${typeof address === 'string' ? address : `${address?.address}:${address?.port}`}\n`,
      );
    });

  return program;
}

function addPollCommand(
  program: Command,
  name: string,
  description: string,
  clientFactory: () => TnlClient,
  stdout: Writer,
  stderr: Writer,
  printStories: boolean,
): void {
  program
    .command(name)
    .description(description)
    .option('--interval <seconds>', 'poll interval in seconds', integer(1, 86_400), 60)
    .option('--state-dir <directory>', 'cache and state directory', defaultStateDirectory())
    .option('--once', 'perform one poll and exit')
    .action(
      async ({
        interval,
        stateDir,
        once,
      }: {
        interval: number;
        stateDir: string;
        once?: boolean;
      }) => {
        const controller = processSignals();
        await runDaemon({
          client: clientFactory(),
          store: new EventStore(stateDir),
          intervalMs: interval * 1_000,
          signal: controller.signal,
          once: once === true,
          writeStatus: (line) => stderr(`${line}\n`),
          ...(printStories ? { onStories: (stories) => writeJson(stdout, stories) } : {}),
        });
      },
    );
}

function processSignals(): AbortController {
  const controller = new AbortController();
  const abort = () => controller.abort();
  process.once('SIGINT', abort);
  process.once('SIGTERM', abort);
  controller.signal.addEventListener(
    'abort',
    () => {
      process.removeListener('SIGINT', abort);
      process.removeListener('SIGTERM', abort);
    },
    { once: true },
  );
  return controller;
}

function integer(minimum: number, maximum: number) {
  return (value: string): number => {
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
      throw new InvalidArgumentError(`expected an integer from ${minimum} to ${maximum}`);
    }
    return parsed;
  };
}
