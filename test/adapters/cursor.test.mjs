import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, readdir, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { describe, it } from 'node:test';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { ADAPTER_WORKFLOWS, selectAdapterProfile } from '../../packages/adapters/dist/index.js';

const root = resolve(import.meta.dirname, '../..');
const plugin = resolve(root, 'integrations/cursor/tnl-intelligence');

describe('Cursor adapter bundle', () => {
  it('validates against the vendored official manifest schema', async () => {
    const schema = await json('schemas/adapters/vendor/cursor/plugin.schema.json');
    const manifest = await json('integrations/cursor/tnl-intelligence/.cursor-plugin/plugin.json');
    const ajv = new Ajv({ allErrors: true, strict: false });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    assert.equal(validate(manifest), true, ajv.errorsText(validate.errors));
    assert.equal(manifest.mcpServers, './mcp.json');
    assert.equal(manifest.skills, './skills/');
  });

  it('contains six discoverable commands and skills mapped to the shared catalog', async () => {
    const commands = (await readdir(resolve(plugin, 'commands'))).filter((name) =>
      name.endsWith('.md'),
    );
    const skills = await readdir(resolve(plugin, 'skills'));
    assert.deepEqual(commands.sort(), ADAPTER_WORKFLOWS.map((item) => `${item.command}.md`).sort());
    assert.deepEqual(skills.sort(), ADAPTER_WORKFLOWS.map((item) => item.id).sort());
    for (const workflow of ADAPTER_WORKFLOWS) {
      const command = await readFile(resolve(plugin, 'commands', `${workflow.command}.md`), 'utf8');
      const skill = await readFile(resolve(plugin, 'skills', workflow.id, 'SKILL.md'), 'utf8');
      assert.match(command, new RegExp(workflow.toolName));
      assert.match(skill, new RegExp(workflow.toolName));
      assert.match(skill, /not investment advice/);
    }
  });

  it('ships secret-free local and remote profiles and requires a choice on conflict', async () => {
    const remote = await json('integrations/cursor/tnl-intelligence/mcp.json');
    const local = await json('integrations/cursor/tnl-intelligence/mcp.local.example.json');
    assert.equal(remote.mcpServers['tnl-intelligence'].url, 'https://mcp.theneuralledger.com/mcp');
    assert.equal(local.mcpServers.tnlIntelligence.command, 'tnl-mcp');
    assert.ok(!JSON.stringify(local).match(/(?:tnl_|sk-)[A-Za-z0-9]{20,}/));
    assert.throws(
      () => selectAdapterProfile({ localConfigured: true, remoteConfigured: true }),
      /choose local or remote/,
    );
  });

  it('supports clean filesystem install, upgrade replacement, and uninstall', async () => {
    const profile = await mkdtemp(join(tmpdir(), 'tnl-cursor-profile-'));
    const installed = resolve(profile, 'plugins/tnl-intelligence');
    await cp(plugin, installed, { recursive: true });
    assert.equal((await stat(resolve(installed, '.cursor-plugin/plugin.json'))).isFile(), true);
    await rm(installed, { recursive: true });
    await cp(plugin, installed, { recursive: true });
    assert.equal(
      (await jsonAbsolute(resolve(installed, '.cursor-plugin/plugin.json'))).version,
      '0.1.0',
    );
    await rm(profile, { recursive: true });
    await assert.rejects(() => stat(profile), /ENOENT/);
  });
});

async function json(path) {
  return jsonAbsolute(resolve(root, path));
}

async function jsonAbsolute(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
