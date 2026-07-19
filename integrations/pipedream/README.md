# TNL Intelligence Pipedream Components

This registry-compatible component directory contains six actions and two signed instant sources.
Actions use the shared connector core. Sources create and delete Tool 04 subscriptions in lifecycle
hooks, verify `event.bodyRaw`, persist the one-time verification secret in `$.service.db`, and emit a
stable `eventId:revision` dedupe ID.

The `tnl_intelligence` Pipedream app must be registered by the owner before external deployment so
managed API-key or OAuth fields can be configured. Local source/action tests do not deploy or publish
components.

```bash
npm run build
npm test
```

TNL output is research, not investment advice. No component executes trades.
