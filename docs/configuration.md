# Configuration

| Variable        | Used by               | Default                       | Purpose                                                |
| --------------- | --------------------- | ----------------------------- | ------------------------------------------------------ |
| `TNL_API_KEY`   | SDK callers, MCP, CLI | Required                      | TNL member API key                                     |
| `TNL_BASE_URL`  | MCP, CLI              | `https://theneuralledger.com` | API origin override for testing or private deployments |
| `TNL_MCP_HOST`  | MCP HTTP              | `127.0.0.1`                   | Bind address                                           |
| `TNL_MCP_PORT`  | MCP HTTP              | `7317`                        | Bind port                                              |
| `TNL_STATE_DIR` | CLI daemon            | `~/.tnl-intelligence`         | Event cache and state directory                        |

Do not place API keys in command arguments, source code, MCP configuration committed to git, container images, or systemd unit files. Use environment injection, editor secret prompts, a protected `EnvironmentFile`, or the container platform's secret facility.

HTTP mode accepts `Authorization: Bearer <TNL key>` per request and forwards it to TNL without persisting it. Keep the default loopback bind unless a reverse proxy supplies TLS, access controls, request limits, and trusted-network isolation.
