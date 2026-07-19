# AI Client Adapters

TNL Intelligence provides generated Cursor and OpenAI plugin bundles under
`integrations/`. Both use `@theneuralledger/adapters` for the six stable research
workflow mappings, task construction, capability negotiation, cited Markdown,
error recovery, and privacy-safe telemetry. They do not contain retrieval or
Codali orchestration.

## Generate And Test

```bash
npm run adapters:generate
npm run adapters:check
npm run test:adapters:contracts
npm run test:adapter:cursor
npm run test:adapter:openai
npm run test:adapters:security
npm run test:adapters
npm run adapters:pack:local
```

Local release candidates and machine-readable evidence are written to
`.artifacts/tool-07/`. Generation reads `adapters/adapter-manifest.json` and
fails when the shared workflow catalog, manifests, connection metadata, or
committed output drifts.

## Cursor

`integrations/cursor/tnl-intelligence` is a current Cursor plugin with commands,
skills, a scoped rule, the remote OAuth MCP profile, and the Tool 06 local MCP
example. Use exactly one connection profile. Remote mode is recommended; local
mode inherits `TNL_API_KEY` from a secret-capable host environment.

## OpenAI

`integrations/openai/tnl-intelligence` is a Codex/ChatGPT plugin bundle with the
remote MCP gateway and six skills. The MCP server supplies the optional research
workspace UI and accessible structured/text fallbacks. The bundle intentionally
omits `.app.json`: ChatGPT developer mode issues that external app ID, so the
owner must create and wire it without committing a fabricated value.

## Review Boundaries

Automated qualification validates schemas, catalog parity, tenant-bound gateway
execution, clean filesystem install/remove behavior, fallbacks, safety language,
and secret scans. Current official documentation sources and the exact manual
positive/negative cases are recorded under `integrations/openai/review/`.

Cursor UI installation, ChatGPT developer-mode creation, live OAuth account
switching, screenshots, test-account entry, and marketplace submission require
owner-controlled accounts or staging. They are reported as external gates, never
as passed automation.
