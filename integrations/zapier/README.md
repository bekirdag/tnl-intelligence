# TNL Intelligence for Zapier

This Zapier Platform CLI 19 integration provides a REST Hook trigger, one search, and four read-only
actions. It runs on Node 22 and reuses `@theneuralledger/connectors` through Zapier's logged request
adapter.

The TNL API key and base64url webhook verification secret are password credentials. Subscribe sends
that pre-shared secret to Tool 04; hook `perform` verifies `bundle.rawRequest.content` before parsing.
The stable `eventId:revision` output lets Zapier deduplicate retries. Unsubscribe deletes the remote
subscription, and `performList` returns static synthetic data with the exact hook shape.

```bash
npm run validate
npm test
npm run build
```

No command pushes or publishes the integration. TNL output is research, not investment advice, and
the integration has no trade-execution action.
