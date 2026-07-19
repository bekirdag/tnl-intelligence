import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { format, resolveConfig } from 'prettier';

const root = resolve(import.meta.dirname, '..');
const contract = JSON.parse(await readFile(resolve(root, 'openapi/tnl.openapi.json'), 'utf8'));
const outputDirectory = resolve(root, 'packages/onboarding/public/postman');
const collectionPath = resolve(outputDirectory, 'collection.json');
const environmentPath = resolve(outputDirectory, 'environment.json');
const check = process.argv.includes('--check');

const sampleRequests = [
  request('Latest sample stories', 'GET', '/v1/sample/news?page_size=2'),
  request('Search sample stories', 'GET', '/v1/search?q=semiconductor&page_size=2'),
  request('Get sample story', 'GET', '/v1/news/sample-story-1'),
  request('List sample entities', 'GET', '/v1/entities'),
  request('List sample impact paths', 'GET', '/v1/impact-paths'),
];
const collection = {
  info: {
    name: 'The Neural Ledger Developer API',
    description: `Generated from TNL OpenAPI ${contract.info.version}. Static sample requests require no key.`,
    schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json',
  },
  variable: [
    { key: 'sample_base_url', value: 'http://127.0.0.1:7320' },
    { key: 'tnl_api_key', value: '', type: 'secret' },
  ],
  item: [
    { name: 'Static sample', item: sampleRequests },
    {
      name: 'Developer credential lifecycle',
      item: [
        developerRequest('List credentials', 'GET', '/developer/api/keys'),
        developerRequest('Create credential', 'POST', '/developer/api/keys', {
          name: 'Postman evaluation',
          scopes: ['news:read'],
          lifetimeDays: 30,
        }),
        developerRequest('Authenticate credential', 'POST', '/developer/api/authenticate', {
          apiKey: '{{tnl_api_key}}',
        }),
        developerRequest('Usage summary', 'GET', '/developer/api/usage'),
      ],
    },
  ],
};
const environment = {
  id: 'tnl-developer-public-safe',
  name: 'TNL Developer Local Sample',
  values: [
    { key: 'sample_base_url', value: 'http://127.0.0.1:7320', enabled: true },
    { key: 'tnl_api_key', value: '', enabled: true, type: 'secret' },
    { key: 'tnl_user', value: 'local-developer', enabled: true },
    { key: 'tnl_tenant', value: 'local-evaluation', enabled: true },
  ],
  _postman_variable_scope: 'environment',
  _postman_exported_using: 'tnl-intelligence workspace generator',
};

await mkdir(outputDirectory, { recursive: true });
await output(collectionPath, collection, check);
await output(environmentPath, environment, check);
console.log(
  check ? 'Onboarding assets match the canonical contract' : 'Onboarding assets generated',
);

function request(name, method, path) {
  return {
    name,
    request: {
      method,
      header: [],
      url: {
        raw: `{{sample_base_url}}${path}`,
        host: ['{{sample_base_url}}'],
        path: path.split('/'),
      },
      description: 'Static synthetic data only. No production member data or credential required.',
    },
    event: [statusTest(200), sampleHeaderTest()],
  };
}

function developerRequest(name, method, path, body) {
  return {
    name,
    request: {
      method,
      header: [
        { key: 'content-type', value: 'application/json' },
        { key: 'x-tnl-user', value: '{{tnl_user}}' },
        { key: 'x-tnl-tenant', value: '{{tnl_tenant}}' },
        { key: 'x-tnl-recent-auth', value: '{{$timestamp}}000' },
      ],
      url: {
        raw: `{{sample_base_url}}${path}`,
        host: ['{{sample_base_url}}'],
        path: path.split('/'),
      },
      ...(body ? { body: { mode: 'raw', raw: JSON.stringify(body, null, 2) } } : {}),
      description: 'Local identity fixtures only. Production uses the TNL authenticated session.',
    },
    event: [statusTest(method === 'POST' && path.endsWith('/keys') ? 201 : 200)],
  };
}

function statusTest(status) {
  return {
    listen: 'test',
    script: { exec: [`pm.test("HTTP ${status}", () => pm.response.to.have.status(${status}));`] },
  };
}

function sampleHeaderTest() {
  return {
    listen: 'test',
    script: {
      exec: [
        'pm.test("static sample lane", () => pm.expect(pm.response.headers.get("x-tnl-data-mode")).to.eql("static-sample"));',
      ],
    },
  };
}

async function output(path, value, checkOnly) {
  const options = { ...(await resolveConfig(path)), filepath: path };
  const content = await format(JSON.stringify(value, null, 2), options);
  if (!checkOnly) {
    await writeFile(path, content, { mode: 0o644 });
    return;
  }
  const existing = await readFile(path, 'utf8').catch(() => '');
  if (existing !== content) throw new Error(`${path} is stale; run npm run onboarding:generate`);
}
