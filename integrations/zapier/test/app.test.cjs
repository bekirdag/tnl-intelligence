const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const App = require('../index');

describe('Zapier integration', () => {
  it('matches the current platform runtime and declares auth, search, actions, and REST Hook', async () => {
    assert.equal(App.version, '0.1.0');
    assert.match(App.platformVersion, /^19\./);
    assert.equal(App.authentication.type, 'custom');
    assert.equal(Object.keys(App.searches).length, 1);
    assert.deepEqual(Object.keys(App.creates).sort(), [
      'get_exposure',
      'get_research_result',
      'get_weekly_edition',
      'list_recent_changes',
      'run_research',
      'search_intelligence',
    ]);
    assert.deepEqual(Object.keys(App.triggers).sort(), [
      'new_or_updated_intelligence',
      'weekly_edition',
    ]);
    const trigger = App.triggers.new_or_updated_intelligence.operation;
    assert.equal(trigger.type, 'hook');
    assert.equal(typeof trigger.performSubscribe, 'function');
    assert.equal(typeof trigger.performUnsubscribe, 'function');
    assert.equal(typeof trigger.performList, 'function');
    const samples = await trigger.performList();
    assert.equal(samples.length, 1);
    assert.deepEqual(Object.keys(samples[0]), Object.keys(trigger.sample));
    const weekly = App.triggers.weekly_edition.operation;
    assert.equal(weekly.sample.type, 'digest.weekly_published');
    assert.ok(!weekly.inputFields.some((field) => field.key === 'event_types'));
  });

  it('keeps signing material in password authentication fields', () => {
    const secret = App.authentication.fields.find((field) => field.key === 'webhook_secret');
    const key = App.authentication.fields.find((field) => field.key === 'api_key');
    assert.equal(secret.type, 'password');
    assert.equal(secret.required, true);
    assert.equal(key.required, true);
  });

  it('omits null optional query parameters from API requests', async () => {
    let requestOptions;
    const z = {
      request: async (options) => {
        requestOptions = options;
        return {
          status: 200,
          data: { data: [], page: { next_cursor: null }, lastSyncAt: '2026-07-20T00:00:00.000Z' },
          throwForStatus() {},
        };
      },
    };

    await App.creates.search_intelligence.operation.perform(z, {
      authData: { api_key: 'test-key', api_url: 'https://example.com' },
      inputData: { query: 'Turkey', page_size: 2 },
    });

    assert.deepEqual(requestOptions.params, { q: 'Turkey', page_size: 2 });
  });
});
