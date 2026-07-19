import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import search from '../actions/search-intelligence/search-intelligence.mjs';
import getResearchResult from '../actions/get-research-result/get-research-result.mjs';
import source from '../sources/new-or-updated-intelligence/new-or-updated-intelligence.mjs';
import weekly from '../sources/weekly-edition/weekly-edition.mjs';

describe('Pipedream components', () => {
  it('declares registry-compatible action metadata', () => {
    assert.equal(search.type, 'action');
    assert.equal(search.version, '0.1.0');
    assert.ok(search.key.startsWith('tnl_intelligence-'));
    assert.equal(search.props.tnl.app, 'tnl_intelligence');
    assert.equal(getResearchResult.type, 'action');
    assert.equal(getResearchResult.props.resultId.type, 'string');
  });

  it('uses HTTP raw body, lifecycle hooks, unique dedupe, and stable emit IDs', () => {
    assert.equal(source.props.http.type, '$.interface.http');
    assert.equal(source.props.http.customResponse, true);
    assert.equal(source.dedupe, 'unique');
    assert.equal(typeof source.hooks.deploy, 'function');
    assert.equal(typeof source.hooks.deactivate, 'function');
    assert.match(source.run.toString(), /event\.bodyRaw/);
    assert.match(source.run.toString(), /id: result\.id/);
    assert.deepEqual(weekly.props.eventTypes.default, ['digest.weekly_published']);
  });
});
