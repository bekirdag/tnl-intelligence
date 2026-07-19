const base = require('./new-or-updated-intelligence');

const operation = base.operation;
const eventType = 'digest.weekly_published';
const sample = {
  ...operation.sample,
  id: 'evt_weeklysample1234:1',
  deliveryId: 'dlv_weeklysample1234',
  type: eventType,
  resourceId: 'edition_weekly_sample',
  canonicalUrl: 'https://theneuralledger.com/weekly/sample',
  summary: 'Synthetic TNL weekly consequential edition event for Zap setup.',
  envelope: {
    ...operation.sample.envelope,
    id: 'evt_weeklysample1234',
    type: eventType,
    resource: {
      id: 'edition_weekly_sample',
      revision: 1,
      url: 'https://theneuralledger.com/weekly/sample',
    },
  },
};

module.exports = {
  ...base,
  key: 'weekly_edition',
  noun: 'Weekly Edition',
  display: {
    label: 'TNL Weekly Consequential Edition',
    description: 'Triggers when TNL publishes a signed weekly consequential edition.',
  },
  operation: {
    ...operation,
    performSubscribe: (z, bundle) =>
      operation.performSubscribe(z, {
        ...bundle,
        inputData: { ...bundle.inputData, event_types: [eventType] },
      }),
    inputFields: operation.inputFields.filter((field) => field.key !== 'event_types'),
    performList: async () => [sample],
    sample,
  },
};
