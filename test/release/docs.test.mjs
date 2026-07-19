import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import test from 'node:test';
import { root, walkFiles } from '../../scripts/release-lib.mjs';

test('all local Markdown links resolve', async () => {
  const files = ['README.md', ...(await walkFiles('docs')).filter((path) => path.endsWith('.md'))];
  const failures = [];
  for (const path of files) {
    const text = await readFile(resolve(root, path), 'utf8');
    for (const match of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      const target = match[1].trim().replace(/^<|>$/g, '').split('#')[0];
      if (!target || /^(?:https?:|mailto:)/.test(target)) continue;
      const absolute = resolve(root, dirname(path), decodeURIComponent(target));
      try {
        await stat(absolute);
      } catch {
        failures.push(`${path} -> ${target}`);
      }
    }
  }
  assert.deepEqual(failures, []);
});

test('release lifecycle documentation and commands are complete', async () => {
  const guide = await readFile(resolve(root, 'docs/release/README.md'), 'utf8');
  const packageJson = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'));
  for (const command of [
    'artifacts:release-candidate',
    'qualify:contracts',
    'qualify:e2e',
    'qualify:security',
    'qualify:privacy',
    'qualify:reliability',
    'qualify:performance',
    'qualify:accessibility',
    'qualify:docs',
    'qualify:release',
  ]) {
    assert.ok(packageJson.scripts[command], command);
    assert.match(guide, new RegExp(command.replace(':', '\\:')));
  }
  for (const path of [
    'docs/release/operations-readiness.md',
    'docs/release/privacy-inventory.md',
    'docs/release/rollback-rehearsal.md',
    'docs/release/go-no-go.md',
  ])
    await access(resolve(root, path));
});
