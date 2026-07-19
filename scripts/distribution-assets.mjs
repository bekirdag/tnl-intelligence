#!/usr/bin/env node
import { readFile, rm, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import {
  introspectPackagedCapabilities,
  renderDistributionArtifacts,
} from '../packages/artifacts/dist/index.js';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const check = process.argv.includes('--check');
const schema = await jsonFile('distribution/schema/mcp-distribution.schema.json');
const manifest = await jsonFile('distribution/mcp-server.json');
const rootPackage = await jsonFile('package.json');
const mcpPackage = await jsonFile('packages/mcp/package.json');

const ajv = new Ajv({ allErrors: true, strict: true });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(manifest))
  throw new TypeError(`Distribution manifest schema failed: ${ajv.errorsText(validate.errors)}`);
if (manifest.product.version !== mcpPackage.version)
  throw new TypeError('Canonical and MCP package versions differ');
if (manifest.product.package !== mcpPackage.name)
  throw new TypeError('Canonical and MCP package names differ');
if (manifest.product.mcpName !== mcpPackage.mcpName)
  throw new TypeError('Canonical and MCP registry names differ');
if (
  manifest.runtime.node !== rootPackage.engines.node ||
  manifest.runtime.node !== mcpPackage.engines.node
)
  throw new TypeError('Canonical and package Node runtime ranges differ');

const capabilities = await introspectPackagedCapabilities();
const outputs = renderDistributionArtifacts(manifest, capabilities);
const problems = [];
for (const [path, content] of outputs) {
  assertPublicArtifact(path, content);
  if (path.endsWith('.json')) JSON.parse(content);
  const absolute = resolve(root, path);
  if (check) {
    try {
      const current = await readFile(absolute, 'utf8');
      if (current !== content) problems.push(`${path} is stale`);
    } catch {
      problems.push(`${path} is missing`);
    }
  } else {
    await mkdir(dirname(absolute), { recursive: true });
    await writeFile(absolute, content);
  }
}

if (!check) {
  const generatedRoot = resolve(root, 'distribution/generated');
  const expected = new Set([...outputs.keys()].map((path) => resolve(root, path)));
  await removeUnexpected(generatedRoot, expected);
}
if (problems.length) throw new TypeError(`Distribution drift detected:\n${problems.join('\n')}`);
process.stdout.write(
  `${check ? 'Checked' : 'Generated'} ${outputs.size} distribution artifacts from ${capabilities.tools.length} runtime tools.\n`,
);

async function jsonFile(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

function assertPublicArtifact(path, content) {
  const forbidden = [root, '/Users/bekirdag', 'BEGIN PRIVATE KEY', 'tnl_live_', 'sk-proj-'];
  for (const value of forbidden) {
    if (content.includes(value)) throw new TypeError(`${path} contains forbidden private material`);
  }
}

async function removeUnexpected(directory, expected) {
  const { readdir } = await import('node:fs/promises');
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await removeUnexpected(path, expected);
      continue;
    }
    if (!expected.has(path)) await rm(path, { force: true });
  }
}
