# OpenAI Plugin Submission Progress

Date: 2026-07-23
Status: Draft configuration in progress

## Completed

- [x] App listing text, verified business identity, public policy links, and four icons saved.
- [x] Web demo trimmed and hosted at
  `https://theneuralledger.com/demos/openai/tnl-intelligence-web-demo.mp4`.
- [x] Production MCP URL set to `https://mcp.theneuralledger.com/mcp`.
- [x] Authentication set to OAuth; metadata discovery completed.
- [x] OpenAI domain challenge served from the parent domain and portal reports
  **Domain verified**.
- [x] Challenge route and public video route deployed in the website release
  ending in commit `b4dc110`.
- [x] MCP contract, authentication, Keycloak configuration, TypeScript, and
  production build checks passed before deployment.

## In progress

- [ ] Complete interactive OAuth consent for the portal's required **Scan Tools** step.
- [ ] Confirm the scan discovers exactly six read-only TNL research tools.

## Remaining portal sections

- [ ] Review generated skills after the tool scan.
- [ ] Add starter prompts from `integrations/openai/review/submission.json`.
- [ ] Add exactly five positive and three negative test cases.
- [ ] Complete global availability and release notes.
- [ ] Replace the provisional web-only demo with a combined web, iOS, and
  Android recording, as required by the portal.
- [ ] Review all attestations and submit for OpenAI review.

## Current blocker

The portal is waiting for the account owner to finish the external OAuth login
or consent window. This is an interactive identity step and cannot be replaced
with an API key or repository automation.
