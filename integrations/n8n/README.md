# TNL Intelligence for n8n

The package provides a unified TNL action node and a signed instant trigger. It uses
`@theneuralledger/connectors` for normalized outputs, research tasks, webhook verification,
deduplication, and subscription lifecycle behavior.

Credentials stay in n8n's credential store. The one-time webhook verification secret is stored in
workflow static data and is never emitted as node output. Activation creates a remote subscription;
deactivation deletes it. Webhooks fail unless n8n exposes the exact raw request body.

Local validation:

```bash
npm run build
npm run lint
npm test
npm pack --dry-run
```

TNL output is research, not investment advice. The node has no trade-execution operation.
