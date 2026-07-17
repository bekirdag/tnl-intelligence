import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { describe, it } from 'node:test';
import { TnlClient } from '@theneuralledger/sdk';
import { createProgram } from '../src/program.js';

describe('tnl command', () => {
  it('renders latest intelligence and applies the requested limit', async () => {
    let request: Request | undefined;
    const client = new TnlClient({
      apiKey: 'secret',
      retries: 0,
      fetch: async (input, init) => {
        request = new Request(input, init);
        return Response.json(newsPage());
      },
    });
    let output = '';
    await createProgram({
      clientFactory: () => client,
      stdout: (text) => (output += text),
    }).parseAsync(['node', 'tnl', 'latest', '--limit', '5']);
    assert.match(request?.url || '', /page_size=5/);
    assert.match(output, /A material event/);
    assert.doesNotMatch(output, /secret/);
  });

  it('rejects invalid numeric options', async () => {
    const result = spawnSync(
      process.execPath,
      ['--import', 'tsx', 'src/bin.ts', 'latest', '--limit', '0'],
      { encoding: 'utf8' },
    );
    assert.equal(result.status, 1);
    assert.match(result.stderr, /expected an integer from 1 to 100/);
  });
});

function newsPage() {
  return {
    data: [{ id: 'story-1', title: 'A material event', category: 'Technology' }],
    page: {
      page: 1,
      page_size: 5,
      offset: 0,
      total_count: 1,
      total_pages: 1,
      has_more: false,
      cursor: null,
      next_cursor: null,
    },
  };
}
