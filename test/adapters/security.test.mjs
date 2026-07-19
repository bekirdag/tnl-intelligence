import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { describe, it } from 'node:test';

const root = resolve(import.meta.dirname, '../..');
const integrationRoot = resolve(root, 'integrations');

describe('adapter security and privacy', () => {
  it('contains no embedded secret, machine-private path, or model-visible credential', async () => {
    const files = await walk(integrationRoot);
    const findings = [];
    for (const file of files.filter((path) => !path.endsWith('.png'))) {
      const text = await readFile(file, 'utf8');
      const relative = file.slice(root.length + 1);
      for (const [name, pattern] of [
        ['private-key', /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
        ['bearer-token', /Bearer\s+[A-Za-z0-9._-]{20,}/],
        ['api-key', /\b(?:sk|tnl)_[A-Za-z0-9]{20,}\b/],
        ['home-path', /\/(?:Users|home)\/[A-Za-z0-9._-]+\//],
      ]) {
        if (pattern.test(text)) findings.push(`${relative}: ${name}`);
      }
    }
    assert.deepEqual(findings, []);
  });

  it('keeps all workflow instructions read-only and preserves server-side safety boundaries', async () => {
    const skills = (await walk(integrationRoot)).filter((path) => path.endsWith('SKILL.md'));
    assert.equal(skills.length, 12);
    for (const file of skills) {
      const content = await readFile(file, 'utf8');
      assert.match(content, /do not execute trades|Never execute/);
      assert.match(content, /untrusted data/);
      assert.match(content, /Call `tnl_research_/);
      assert.ok(!content.includes('chain-of-thought'));
    }
  });
});

async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await walk(path)));
    else output.push(path);
  }
  return output.sort();
}
