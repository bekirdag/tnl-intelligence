# Automation Connectors

TNL provides read-only actions and signed instant triggers for n8n, Pipedream,
and Zapier. All hosts expose the same six operation IDs from
`@theneuralledger/connectors` and use the Tool 04 event envelope.

## Operations

| ID                    | Purpose                                                | Scope          |
| --------------------- | ------------------------------------------------------ | -------------- |
| `search_intelligence` | Search cited intelligence with cursor and time filters | `tnl:read`     |
| `get_intelligence`    | Retrieve one stable story revision                     | `tnl:read`     |
| `list_recent_changes` | Read publication, update, and retraction changes       | `tnl:read`     |
| `get_exposure`        | Resolve entity, asset, or impact-path exposure         | `tnl:read`     |
| `run_research`        | Run an approved evidence-first Tool 05 workflow        | `tnl:research` |
| `get_weekly_edition`  | Retrieve the weekly consequential-development result   | `tnl:research` |

The generated parity record is
[`connectors/generated/parity.json`](../connectors/generated/parity.json). Zapier
represents `list_recent_changes` through the instant trigger and its sample-list
contract; all other operations are direct actions or searches.

## Signed Triggers

The hosts support publication, update, retraction, impact-change, and weekly
edition events. Activation creates a remote subscription and deactivation removes
it. Each host verifies the HMAC over the exact raw request bytes before parsing,
rejects stale or replayed deliveries, and deduplicates by `eventId:revision`.

The subscription service returns a canonical base64url secret. n8n and Pipedream
store it in workflow-managed state. Zapier requires the same secret in its
password credential because `performSubscribe` data is not exposed to the later
REST Hook `perform` invocation. The control API receives that pre-shared value at
subscription creation, so the delivery service and Zapier hold the same decoded
key bytes.

## Host Packages

### n8n

`integrations/n8n` contains one credential, the `TNL Intelligence` action node,
and the `TNL Trigger` node. n8n Cloud prohibits runtime dependencies in community
nodes, so this package contains a self-contained transport and verifier generated
against the shared catalog. It passes the current strict `@n8n/node-cli` cloud
lint and uses Node 22.

### Pipedream

`integrations/pipedream` contains the app definition, six actions, and two
sources. Sources use `event.bodyRaw`, `$.service.db`, unique event IDs, deploy and
deactivate hooks, and explicit HTTP responses. The package consumes the shared
connector core; install its local tarball during development until the npm
package is published.

### Zapier

`integrations/zapier` contains custom authentication, one search, four actions,
and one REST Hook trigger. Zapier builds an isolated temporary project, so its
runtime is self-contained and does not require an unpublished TNL package. The
current Zapier 19 validator reports 28 checks passed with no errors, publishing
tasks, or warnings.

## Local Qualification

Use Node 22:

```bash
npm run test:connectors
```

The gate builds and validates every host, runs action, raw-body, dedupe, and
lifecycle fixtures, generates local package candidates, scans them for secrets
and private paths, then installs all tarballs in a clean temporary consumer. It
writes private evidence to `.artifacts/tool-08/qualification-evidence.json`.

Individual gates:

```bash
npm run test:connectors:core
npm run test:connector:n8n
npm run test:connector:pipedream
npm run test:connector:zapier
npm run test:connectors:parity
npm run connectors:pack:local
```

## Production Boundary

The repository candidates do not create platform accounts, register apps, upload
packages, or submit marketplace listings. n8n creator verification, Pipedream and
Zapier app registration, hosted callback canaries, and marketplace review require
owner-controlled accounts and staging credentials. No connector executes trades
or accepts broker credentials.
