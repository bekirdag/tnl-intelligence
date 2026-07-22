# OpenAI Plugin Submission Progress

Date: 2026-07-23
Status: Draft complete except owner-controlled submission gates

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
- [x] Interactive OAuth consent completed and the portal scan discovered all
  six read-only TNL research tools.
- [x] All 18 read-only, closed-world, and non-destructive annotation
  justifications saved.
- [x] Three starter prompts saved.
- [x] Exactly five positive and three negative reviewer test cases saved.
- [x] Global availability set to all supported countries.
- [x] Initial release notes saved and the non-adult-content selection set to No.
- [x] Optional reusable Skills upload skipped; the application is MCP-backed
  and the six production tools are already scanned.

## Remaining portal sections

- [ ] Replace the provisional web-only demo with a combined web, iOS, and
  Android recording, as required by the portal.
- [ ] Add immediate-access, no-2FA OAuth test credentials for the entitled demo account.
- [ ] Business owner reviews and personally accepts all seven legal/policy attestations.
- [ ] Submit for OpenAI review.

## Current blocker

OpenAI explicitly requires the demo to cover web, iOS, and Android, while the
hosted recording currently covers web only. The submission also needs reusable
OAuth reviewer credentials and owner acceptance of legal attestations. These
steps require the account/device/business owner and cannot be truthfully
completed through repository or browser automation alone.
