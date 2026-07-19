# TNL Intelligence

Open-source developer tools for [The Neural Ledger](https://theneuralledger.com) intelligence API.

TNL Intelligence gives AI agents and quantitative research systems structured, source-linked global event intelligence. It is an evidence and research layer, not a broker, an order router, or a source of trading-grade prices.

## Packages

| Package                       | Purpose                                                      |
| ----------------------------- | ------------------------------------------------------------ |
| `@theneuralledger/sdk`        | Typed TypeScript client for the TNL `/v1` API                |
| `@theneuralledger/mcp`        | Read-only MCP server over stdio or Streamable HTTP           |
| `@theneuralledger/gateway`    | Hosted OAuth, tenant policy, quota, and audit MCP gateway    |
| `@theneuralledger/onboarding` | Developer credentials, static sample API, and explorer       |
| `@theneuralledger/events`     | Webhook contracts, signed delivery, and verification helpers |
| `@theneuralledger/research`   | Evidence-first skills, orchestration, MCP App, and web UI    |
| `@theneuralledger/adapters`   | Shared Cursor and OpenAI workflow contracts and rendering    |
| `@theneuralledger/connectors` | Shared n8n, Pipedream, and Zapier action/trigger contracts   |
| `@theneuralledger/cli`        | `tnl` CLI, watch command, local cache, and foreground daemon |
| `tnl-intelligence`            | Python SDK and optional point-in-time quant research toolkit |

## Quick Start

Set a member API key in the environment:

```bash
export TNL_API_KEY="..."
```

Run the MCP server over stdio:

```bash
npx -y @theneuralledger/mcp
```

Or run its localhost Streamable HTTP endpoint:

```bash
docker compose up --build
curl http://127.0.0.1:7317/healthz
```

Use the CLI:

```bash
npx -y @theneuralledger/cli latest
npx -y @theneuralledger/cli search "Federal Reserve"
```

Use the TypeScript SDK:

```ts
import { TnlClient } from '@theneuralledger/sdk';

const client = new TnlClient({ apiKey: process.env.TNL_API_KEY! });
const page = await client.listNews({ sort: 'pipeline', pageSize: 20 });
```

Use the Python SDK:

```python
from tnl_intelligence import TnlClient

with TnlClient(api_key="...") as client:
    page = client.list_news(sort="pipeline", page_size=20)
```

## Security

- API keys are never accepted as visible command-line arguments.
- MCP tools are read-only and do not place trades.
- Streamable HTTP binds to `127.0.0.1` by default.
- Local daemon events never contain the API key.
- Hosted deployments use the separate gateway, TLS ingress, OAuth validation,
  tenant policy, short-lived upstream capabilities, and distributed quotas.

See [SECURITY.md](SECURITY.md) and the [build plan](docs/planning/tnl-intelligence-build-plan.md).
Research deployment boundaries and staged rollout are documented in
[Research operations](docs/research-operations.md).

## Development

```bash
npm install
npm run openapi:sync
npm run validate
```

Python development uses the project under `python/tnl_intelligence`.

## Documentation

- [Architecture](docs/architecture.md)
- [Configuration and credential handling](docs/configuration.md)
- [Hosted gateway operations](docs/gateway-operations.md)
- [Developer onboarding](docs/developer/index.md)
- [Webhook operations](docs/webhook-operations.md)
- [Foreground daemon operations](docs/daemon.md)
- [Publication runbook](docs/publishing.md)
- [Distribution and product expansion strategy](docs/distribution-and-product-expansion.md)
- [AI client adapters](docs/ai-client-adapters.md)
- [Automation connectors](docs/automation-connectors.md)
- [Quantitative research toolkit](docs/quant-research-toolkit.md)
- [Implementation plan](docs/planning/tnl-intelligence-build-plan.md)
- [Distribution tools build plan](docs/planning/tnl-distribution-tools-build-plan.md)

## License

MIT
