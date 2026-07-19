# Configuration

| Variable                    | Used by             | Default                       | Purpose                                                |
| --------------------------- | ------------------- | ----------------------------- | ------------------------------------------------------ |
| `TNL_API_KEY`               | SDK, MCP stdio, CLI | Required                      | TNL member API key                                     |
| `TNL_BASE_URL`              | MCP, CLI            | `https://theneuralledger.com` | API origin override for testing or private deployments |
| `TNL_MCP_HOST`              | MCP HTTP            | `127.0.0.1`                   | Bind address                                           |
| `TNL_MCP_PORT`              | MCP HTTP            | `7317`                        | Bind port                                              |
| `TNL_MCP_ALLOW_ENV_API_KEY` | MCP HTTP            | `false`                       | Permit loopback single-user environment-key fallback   |
| `TNL_STATE_DIR`             | CLI daemon          | `~/.tnl-intelligence`         | Event cache and state directory                        |

Do not place API keys in command arguments, source code, MCP configuration committed to git, container images, or systemd unit files. Use environment injection, editor secret prompts, a protected `EnvironmentFile`, or the container platform's secret facility.

HTTP mode accepts `Authorization: Bearer <TNL key>` per request and forwards it to TNL without persisting it. Keep the default loopback bind unless a reverse proxy supplies TLS, access controls, request limits, and trusted-network isolation.

The HTTP server does not authorize a request from `TNL_API_KEY` by default. `TNL_MCP_ALLOW_ENV_API_KEY=1` enables that fallback only for an explicitly trusted, loopback-only, single-user process.

Do not expose the basic MCP HTTP mode as a shared hosted service. Multi-user
deployments use `@theneuralledger/gateway`; its production identity,
control-plane, readiness, secret, quota, and audit variables are documented in
[Gateway Operations](gateway-operations.md).
