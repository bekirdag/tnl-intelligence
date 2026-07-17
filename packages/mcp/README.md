# @theneuralledger/mcp

Read-only Model Context Protocol server for The Neural Ledger event and evidence intelligence API.

## Stdio

```bash
TNL_API_KEY=tnl_... npx -y @theneuralledger/mcp
```

## Streamable HTTP

```bash
TNL_API_KEY=tnl_... npx -y @theneuralledger/mcp http
```

The server binds to `127.0.0.1:7317` by default. Override it with `TNL_MCP_HOST` and `TNL_MCP_PORT`. HTTP clients may send their TNL key as `Authorization: Bearer ...`; it is forwarded only to the TNL API and is never included in tool output.

The tools expose news search, asset/entity/impact-path intelligence, event explanation, Ledger AI deep research, and service status. TNL provides event and evidence intelligence; its market quotes are display context rather than an execution-grade price feed.
