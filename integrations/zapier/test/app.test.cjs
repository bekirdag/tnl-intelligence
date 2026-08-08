const assert = require('node:assert/strict');
const { describe, it } = require('node:test');
const App = require('../index');

describe('Zapier integration', () => {
  it('matches the current platform runtime and declares auth, search, actions, and REST Hook', async () => {
    assert.equal(App.version, '1.0.3');
    assert.match(App.platformVersion, /^19\./);
    assert.equal(App.authentication.type, 'custom');
    assert.equal(Object.keys(App.searches).length, 1);
    assert.deepEqual(Object.keys(App.creates).sort(), [
      'get_exposure',
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
    assert.equal(key.type, 'password');
    assert.equal(key.required, true);
    assert.equal(App.authentication.connectionLabel, '{{connection_name}}');
  });

  it('uses reviewer-compliant weekly labels and third-person action descriptions', () => {
    assert.equal(
      App.triggers.weekly_edition.display.label,
      'New TNL Weekly Consequential Edition',
    );
    assert.equal(App.creates.get_weekly_edition.display.label, 'Create TNL Weekly Edition');

    for (const action of [...Object.values(App.creates), ...Object.values(App.searches)]) {
      assert.match(
        action.display.description,
        /^(Creates|Finds|Lists|Retrieves|Runs|Searches)\b/,
      );
    }
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

  it('normalizes Zapier list defaults before creating a webhook subscription', async () => {
    let requestOptions;
    const z = {
      request: async (options) => {
        requestOptions = options;
        return {
          status: 201,
          data: {
            data: {
              subscription: {
                id: 'sub_test123456789',
                activeKeyId: 'key_test123456789',
              },
              secret: 'test-webhook-secret',
            },
          },
          throwForStatus() {},
        };
      },
    };

    const result =
      await App.triggers.new_or_updated_intelligence.operation.performSubscribe(z, {
        authData: {
          api_key: 'test-key',
          webhook_secret: 'test-webhook-secret',
          webhook_url: 'https://hooks.example.com',
        },
        inputData: {
          event_types: ['intelligence.published,intelligence.updated'],
        },
        targetUrl: 'https://hooks.zapier.com/hooks/standard/example',
      });

    assert.deepEqual(requestOptions.body.eventTypes, [
      'intelligence.published',
      'intelligence.updated',
    ]);
    assert.deepEqual(result, { id: 'sub_test123456789' });
  });
});
