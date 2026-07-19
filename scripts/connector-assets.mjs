import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import Ajv2020 from 'ajv/dist/2020.js';
import addFormats from 'ajv-formats';
import { CONNECTOR_OPERATIONS } from '../packages/connectors/dist/index.js';

const root = resolve(import.meta.dirname, '..');
const check = process.argv.includes('--check');
const manifest = await json('connectors/connector-manifest.json');
const schema = await json('schemas/connectors/connector-manifest.schema.json');
const ajv = new Ajv2020({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);
if (!validate(manifest)) throw new Error(ajv.errorsText(validate.errors));

const hostSurfaces = await inspectHostSurfaces();

const parity = {
  schemaVersion: '1.0',
  connectorVersion: manifest.connectorVersion,
  generatedFrom: 'connectors/connector-manifest.json',
  operations: CONNECTOR_OPERATIONS.map((operation) => ({
    ...operation,
    n8n: hostSurfaces.n8n.operations.has(operation.id),
    pipedream: hostSurfaces.pipedream.operations.has(operation.id),
    zapier: hostSurfaces.zapier.operations.has(operation.id),
    notes: '',
  })),
  triggers: manifest.triggerEventTypes.map((type) => ({
    type,
    n8n: hostSurfaces.n8n.triggers.has(type),
    pipedream: hostSurfaces.pipedream.triggers.has(type),
    zapier: hostSurfaces.zapier.triggers.has(type),
  })),
  verification: {
    n8n: 'compiled action runtime plus signed-trigger event catalog',
    pipedream: 'action/source modules present and imported by platform tests',
    zapier: 'registered creates/searches/triggers in exported App',
  },
  guarantees: {
    signedRawBody: true,
    stableDedupeId: 'eventId:revision',
    subscribe: true,
    unsubscribe: true,
    pollingBackfillDefault: false,
  },
};
const review = {
  schemaVersion: '1.0',
  connectorVersion: manifest.connectorVersion,
  platforms: manifest.platforms,
  privacy: 'https://theneuralledger.com/privacy',
  support: 'https://theneuralledger.com/contact',
  security: 'https://github.com/bekirdag/tnl-intelligence/blob/main/SECURITY.md',
  limitations: [
    'Read-only intelligence and research; no trade execution.',
    'At-least-once webhooks require eventId:revision deduplication.',
    'Large story bodies are opt-in.',
  ],
  externalOwnerGates: [
    { id: 'n8n-creator-verification', status: 'not-performed' },
    { id: 'pipedream-app-registration', status: 'not-performed' },
    { id: 'zapier-app-registration', status: 'not-performed' },
    { id: 'marketplace-submission', status: 'not-performed' },
  ],
  officialSources: manifest.officialSources,
};
const outputs = new Map([
  ['connectors/generated/parity.json', pretty(parity)],
  ['connectors/generated/review.json', pretty(review)],
]);
for (const directory of [
  'actions/search-intelligence',
  'actions/get-intelligence',
  'actions/list-recent-changes',
  'actions/get-exposure',
  'actions/run-research',
  'actions/get-research-result',
  'actions/get-weekly-edition',
  'sources/new-or-updated-intelligence',
  'sources/weekly-edition',
]) {
  outputs.set(
    `integrations/pipedream/${directory}/README.md`,
    `# ${directory.split('/').at(-1).replaceAll('-', ' ')}\n\nTNL Intelligence Pipedream component generated from the shared Tool 08 catalog. Credentials remain in Pipedream managed auth. Sources verify the exact raw body and remove subscriptions during deactivation. Output is research, not investment advice, and does not execute trades.\n`,
  );
}
const botIcon = (stroke, screen) => `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${stroke}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
  <path d="M12 3v2"/><circle cx="12" cy="2" r="1" fill="${screen}" stroke="none"/>
  <rect x="4" y="6" width="16" height="13" rx="3" fill="${screen}"/>
  <path d="M8 19v3m8-3v3M4 11H2m20 0h-2"/>
  <circle cx="9" cy="11" r="1" fill="${stroke}" stroke="none"/><circle cx="15" cy="11" r="1" fill="${stroke}" stroke="none"/>
  <path d="M9 15h6"/>
</svg>
`;
outputs.set('integrations/n8n/icons/tnl-bot.svg', botIcon('#151515', '#f4b942'));
outputs.set('integrations/n8n/icons/tnl-bot-dark.svg', botIcon('#f5f5f5', '#b5dfca'));

const stale = [];
for (const [path, content] of outputs) {
  const absolute = resolve(root, path);
  const expected = Buffer.isBuffer(content) ? content : Buffer.from(content);
  const current = await readFile(absolute).catch(() => undefined);
  if (!current?.equals(expected)) {
    stale.push(path);
    if (!check) {
      await mkdir(dirname(absolute), { recursive: true });
      await writeFile(absolute, expected);
    }
  }
}
if (check && stale.length) throw new Error(`Connector assets are stale: ${stale.join(', ')}`);
process.stdout.write(`${check ? 'Verified' : 'Generated'} ${outputs.size} connector assets.\n`);

async function json(path) {
  return JSON.parse(await readFile(resolve(root, path), 'utf8'));
}

async function inspectHostSurfaces() {
  const operationPaths = {
    n8n: Object.fromEntries(
      CONNECTOR_OPERATIONS.map(({ id }) => [id, 'integrations/n8n/nodes/shared/runtime.ts']),
    ),
    pipedream: Object.fromEntries(
      CONNECTOR_OPERATIONS.map(({ id }) => [
        id,
        `integrations/pipedream/actions/${id.replaceAll('_', '-')}/${id.replaceAll('_', '-')}.mjs`,
      ]),
    ),
    zapier: {
      search_intelligence: 'integrations/zapier/creates/search-intelligence.js',
      get_intelligence: 'integrations/zapier/searches/find-intelligence.js',
      list_recent_changes: 'integrations/zapier/creates/list-recent-changes.js',
      get_exposure: 'integrations/zapier/creates/get-exposure.js',
      run_research: 'integrations/zapier/creates/run-research.js',
      get_research_result: 'integrations/zapier/creates/get-research-result.js',
      get_weekly_edition: 'integrations/zapier/creates/get-weekly-edition.js',
    },
  };
  const eventSources = {
    n8n: 'integrations/n8n/nodes/shared/runtime.ts',
    pipedream:
      'integrations/pipedream/sources/new-or-updated-intelligence/new-or-updated-intelligence.mjs',
    zapier: 'integrations/zapier/triggers/new-or-updated-intelligence.js',
  };
  const surfaces = {};
  for (const host of ['n8n', 'pipedream', 'zapier']) {
    const operations = new Set();
    for (const operation of CONNECTOR_OPERATIONS) {
      const path = operationPaths[host][operation.id];
      const content = await readFile(resolve(root, path), 'utf8').catch(() => '');
      if (content.includes(operation.id)) operations.add(operation.id);
    }
    const eventSource = await readFile(resolve(root, eventSources[host]), 'utf8').catch(() => '');
    const triggers = new Set(
      manifest.triggerEventTypes.filter((eventType) => eventSource.includes(eventType)),
    );
    surfaces[host] = { operations, triggers };
  }
  const missing = [];
  for (const operation of CONNECTOR_OPERATIONS) {
    for (const host of ['n8n', 'pipedream', 'zapier']) {
      if (!surfaces[host].operations.has(operation.id)) missing.push(`${host}:${operation.id}`);
    }
  }
  for (const eventType of manifest.triggerEventTypes) {
    for (const host of ['n8n', 'pipedream', 'zapier']) {
      if (!surfaces[host].triggers.has(eventType)) missing.push(`${host}:${eventType}`);
    }
  }
  if (missing.length) throw new Error(`Connector host surfaces are missing: ${missing.join(', ')}`);
  return surfaces;
}

function pretty(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}
