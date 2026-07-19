# TNL Intelligence OpenAI Plugin

This repository-ready plugin combines six shared research skills with the hosted TNL MCP gateway at `https://mcp.theneuralledger.com/mcp`. The gateway supplies read-only tool annotations, structured claims and evidence, cited text fallback, and the `ui://tnl/research-workspace` MCP App resource.

## Local validation

1. Install the plugin directory through a personal Codex marketplace or plugin development flow.
2. Confirm all six skills are discovered.
3. Connect the remote MCP server and complete OAuth with only `tnl:read tnl:research`.
4. Run the positive and negative cases in `../review/manual-validation.md`.
5. Remove the plugin and revoke the OAuth grant; no local credential file should remain.

## Owner-only portal step

ChatGPT developer mode creates the app identifier required for an `.app.json` entry. This bundle intentionally does not invent or commit that external ID. After the owner creates the app, wire it in the portal and run the review worksheet before submission. Marketplace submission is not performed by repository automation.

Privacy: https://theneuralledger.com/privacy | Support: https://theneuralledger.com/contact | Terms: https://theneuralledger.com/terms
