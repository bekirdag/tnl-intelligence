# @theneuralledger/mcp

Read-only Model Context Protocol server for The Neural Ledger event and evidence intelligence API.

## Stdio

```bash
TNL_API_KEY=tnl_... npx -y @theneuralledger/mcp
```

## Streamable HTTP

```bash
npx -y @theneuralledger/mcp http
```

The server binds to `127.0.0.1:7317` by default. Override it with `TNL_MCP_HOST` and `TNL_MCP_PORT`. HTTP clients may send their TNL key as `Authorization: Bearer ...`; it is forwarded only to the TNL API and is never included in tool output.

HTTP mode requires a bearer key even when `TNL_API_KEY` is present in the server environment. A loopback-only single-user deployment can explicitly restore environment-key fallback with `TNL_MCP_ALLOW_ENV_API_KEY=1`; do not enable that mode on a shared or remotely reachable server.

The tools expose news search, asset/entity/impact-path intelligence, event explanation, Ledger AI deep research, and service status. TNL provides event and evidence intelligence; its market quotes are display context rather than an execution-grade price feed.

When configured with a `TnlResearchRunner`, the server also exposes six scoped
`tnl_research_*` tools plus the `ui://tnl/research-workspace` MCP App resource.
Without that runner, research tools are not advertised. Hosted callers must hold
the `tnl:research` scope in addition to base read access.
