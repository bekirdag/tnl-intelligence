# Tool 07: AI Client Adapters Build Progress

Date: 2026-07-19
Status: Repository implementation complete; live host validation pending owner action
Plan: [AI Client Adapters Build Plan](07-ai-client-adapters-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                         | Status   | Evidence or next gate                                                                                                     |
| ---------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------- |
| Current platform contract research | Complete | Official Cursor plugin schema and current OpenAI plugin, Apps SDK, MCP, OAuth, and review docs recorded                   |
| Shared adapter core                | Complete | Six workflows, task building, capability negotiation, errors, Markdown, and telemetry ship in `@theneuralledger/adapters` |
| Cursor integration                 | Complete | Generated plugin has remote/local profiles, six commands/skills, scoped rule, icon, and clean filesystem lifecycle tests  |
| OpenAI integration                 | Complete | Generated remote plugin has six skills, MCP App/text fallback contract, and owner-gated app-ID instructions               |
| Security and tenant isolation      | Complete | Gateway runner binds resolved tenant/principal; scope, invalid result, conflict, redaction, and secret scans pass         |
| Review and release evidence        | Complete | Deterministic submission worksheet, manual cases, archives, hashes, and qualification evidence generated                  |
| Qualification and regressions      | Complete | Aggregate Tool 07 qualification passes; prior-tool/full repository regression remains a Tool 10 gate                      |

## Current Implementation Decisions

1. Both host adapters reuse the Tool 05 research contracts and Tool 02 MCP gateway; vendor bundles contain no copied orchestration.
2. Cursor supports Tool 06 local and remote profiles; the OpenAI adapter uses the hosted remote MCP gateway only.
3. Credentials remain host-managed inputs and never enter prompts, generated files, fixtures, or review evidence.
4. Tool descriptions remain read-only and time-aware, with TNL Bot attribution and explicit financial-research limitations.
5. Marketplace submission, account creation, and reviewer communication remain outside repository implementation.

## Validation Evidence

| Check                                  | Result                 | Evidence                                                                                                                                                |
| -------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tools 01-06 prerequisites              | Pass                   | Shared services, research contracts, and install artifacts pass                                                                                         |
| Repository and detailed plan review    | Pass                   | Shared, Cursor, OpenAI, security, and qualification gates read                                                                                          |
| Official current platform verification | Pass                   | Sources and 2026-07-18 access date are canonical manifest fields                                                                                        |
| Impact, symbols, AST, and DAG analysis | Pass with tooling note | Docdex search/DAG and CLI impact graphs used; MCP symbols/AST session was expired, so search symbol context and strict compiler/tests provided fallback |
| Shared contract and host tests         | Pass                   | 6 shared, 17 gateway, 4 Cursor, 3 OpenAI, and 2 security tests pass                                                                                     |
| Generated assets                       | Pass                   | 32 assets reproduce from one strict canonical manifest and six-workflow catalog                                                                         |
| Clean-profile and review evidence      | Pass                   | Filesystem install/replace/remove pass; two deterministic extractable archives and reviewer worksheet generated                                         |
| Archive digests                        | Pass                   | Cursor `1dede032...03bed`; OpenAI `f2b6990b...a6320`                                                                                                    |
| Aggregate qualification                | Pass                   | `npm run test:adapters`; evidence digest `abf02a4d...9eb5`                                                                                              |

## Current Blockers

No repository blocker. Cursor UI install, ChatGPT developer-mode app creation,
live OAuth account switching, screenshots, and marketplace submission require
owner-controlled accounts or staging and are recorded as external gates rather
than automated passes.

## Next Gate

Run Cursor and OpenAI host UI, app-ID, OAuth account-switching, and staging
canaries, then submit only after owner review.
