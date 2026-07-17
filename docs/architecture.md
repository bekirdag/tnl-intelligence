# Architecture

TNL Intelligence is a set of read-only adapters over The Neural Ledger `/v1` API.

```text
TNL API + OpenAPI snapshot
          |
    TypeScript SDK
     /          \
MCP server    CLI/daemon

TNL API + OpenAPI snapshot
          |
      Python SDK
```

The TypeScript SDK owns authentication, request mapping, pagination, retries, timeouts, and error normalization. MCP and CLI depend on it. The Python package implements the same public API concepts independently so Python installations do not require Node.js.

The MCP server exposes read-only tools, resources, and prompts. Stdio is intended for local clients. Streamable HTTP is stateless and binds to loopback by default; each request can provide its TNL member key as a bearer token. A public multi-tenant MCP service requires TNL-side OAuth and TLS and is deliberately outside this repository.

The daemon polls with `updated_since`, writes each unseen story version to an immutable JSONL stream, then atomically replaces its state file. The state keeps a bounded set of revision fingerprints. TNL remains the source of generated intelligence; local tools do not synthesize or modify stories.

TNL market quotes are contextual display values. Trading systems must pair TNL intelligence with a licensed, execution-grade market data source and their own risk controls.
