import { readdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = resolve(import.meta.dirname, '..');
const files = [
  ...(await components(resolve(root, 'actions'))),
  ...(await components(resolve(root, 'sources'))),
];
const keys = new Set();
for (const file of files) {
  const component = (await import(pathToFileURL(file))).default;
  for (const field of ['key', 'name', 'description', 'version', 'props', 'run']) {
    if (!component[field]) throw new Error(`${file} is missing ${field}`);
  }
  if (keys.has(component.key)) throw new Error(`Duplicate Pipedream key ${component.key}`);
  keys.add(component.key);
  if (!component.key.startsWith('tnl_intelligence-')) throw new Error(`Invalid component key ${component.key}`);
  if (file.includes('/actions/') && component.type !== 'action') throw new Error(`${component.key} must be an action`);
  if (file.includes('/sources/')) {
    if (!component.hooks?.deploy || !component.hooks?.deactivate)
      throw new Error(`${component.key} is missing source lifecycle hooks`);
    if (component.dedupe !== 'unique') throw new Error(`${component.key} must declare unique dedupe`);
  }
}
process.stdout.write(`Validated ${files.length} Pipedream components.\n`);

async function components(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) output.push(...(await components(path)));
    else if (entry.name.endsWith('.mjs')) output.push(path);
  }
  return output.sort();
}
