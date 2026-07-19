const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { describe, it } = require('node:test');

describe('n8n package metadata', () => {
  it('registers one credential and both built nodes', () => {
    const pkg = JSON.parse(readFileSync(resolve(__dirname, '../package.json'), 'utf8'));
    assert.equal(pkg.n8n.n8nNodesApiVersion, 1);
    assert.equal(pkg.n8n.strict, true);
    assert.equal(pkg.n8n.credentials.length, 1);
    assert.equal(pkg.n8n.nodes.length, 2);
    assert.ok(pkg.keywords.includes('n8n-community-node-package'));
  });
});
