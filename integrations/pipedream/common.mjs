import {
  ConnectorClient,
  HttpConnectorResearchRunner,
  HttpConnectorSubscriptionClient,
} from '@theneuralledger/connectors';

export function clientFor(app) {
  const connection = app.connection();
  return new ConnectorClient({
    apiKey: connection.apiKey,
    baseUrl: connection.baseUrl,
    research: new HttpConnectorResearchRunner({
      baseUrl: connection.researchUrl,
      credential: connection.apiKey,
    }),
  });
}

export function subscriptionsFor(app) {
  const connection = app.connection();
  return new HttpConnectorSubscriptionClient({
    baseUrl: connection.webhookUrl,
    credential: connection.apiKey,
  });
}

export const appProp = { type: 'app', app: 'tnl_intelligence' };

export function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== ''));
}
