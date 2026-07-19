# TNL Intelligence for Cursor

This plugin exposes six cited TNL research workflows through the existing MCP boundary. It contains no research orchestration or credentials.

## Remote mode (recommended)

1. Install this directory or the local marketplace at `integrations/cursor`.
2. Keep `mcp.json` active. Cursor connects to `https://mcp.theneuralledger.com/mcp` and discovers OAuth through `https://mcp.theneuralledger.com/.well-known/oauth-protected-resource`.
3. Grant only `tnl:read tnl:research` when prompted.
4. Run a `/tnl-*` command and verify citations, `asOf`, and TNL Bot attribution.

## Local mode

1. Disable the remote `mcp.json` entry. Do not run both profiles concurrently.
2. Copy the server entry from `mcp.local.example.json` into the active host MCP configuration.
3. Set `TNL_API_KEY` in Cursor's secret-capable environment. Never place its value in this repository.
4. Restart the MCP server and verify its capability list. Local mode exposes only capabilities present in the installed Tool 06 artifact.

## Remove

Disable the TNL MCP server, remove this plugin, and revoke remote OAuth access or unset `TNL_API_KEY`. The plugin creates no background daemon and stores no credential.

Support: https://theneuralledger.com/contact | Privacy: https://theneuralledger.com/privacy
