# Contributing

1. Open an issue describing the change and its user-visible behavior.
2. Keep packages read-only with respect to trading and brokerage systems.
3. Add or update tests for every behavior change.
4. Run `npm run validate` and the Python validation commands before opening a pull request.
5. Never include API keys, private story payloads, account identifiers, or local daemon state.

Changes to public package names, authentication behavior, MCP tool schemas, or the vendored OpenAPI contract require an explicit compatibility note.
