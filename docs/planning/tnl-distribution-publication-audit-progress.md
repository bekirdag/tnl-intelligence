# TNL Distribution Publication Audit Progress

Date: 2026-07-20
Status: In progress — previous completion claim withdrawn
Plan: [TNL Distribution Publication Audit Plan](tnl-distribution-publication-audit-plan.md)

## Workstream Progress

| Workstream                             | Status        | Evidence or next gate                                                                                         |
| -------------------------------------- | ------------- | ------------------------------------------------------------------------------------------------------------- |
| Public registry reconciliation         | Complete      | Four npm packages and `tnl-intelligence==0.1.0` verified from their public registries                         |
| GitHub Release and GHCR reconciliation | Complete      | Public `v0.1.0` release and container package verified                                                        |
| Autonomous publication boundary        | In progress   | Created accounts are now available; marketplace and deployment state is being re-audited                      |
| Repository-owned discovery publication | Complete      | Added and publicly verified 18 accurate GitHub topics                                                         |
| Official MCP Registry                  | Published     | `com.theneuralledger/intelligence@0.1.0` is active                                                            |
| Postman                                | Published     | Public workspace and 25-request collection verified                                                           |
| Glama                                  | Under review  | Repository submitted on 2026-07-20                                                                            |
| n8n community node                     | In progress   | Provenance workflow added; npm rejected the first run for fresh web/2FA authorization                         |
| OpenAI plugin                          | Built         | Manifest, MCP configuration, assets, and six skills pass local plugin validation; no portal submission exists |
| Zapier integration                     | Account-ready | Developer account exists; no integration version has been registered or deployed                              |
| Pipedream app/components               | Account-ready | Workspace exists; no public app or component contribution has been submitted                                  |
| Cursor plugin                          | Account-ready | Candidate exists; no publisher application or plugin submission exists                                        |
| Smithery                               | Account-ready | Namespace and CLI authentication exist; publication awaits a public remote MCP endpoint                       |
| Distribution strategy update           | In progress   | Correcting qualified-versus-published language and recording external evidence                                |

## Verified Public Baseline

- npm: `@theneuralledger/sdk@0.1.0`, `@theneuralledger/research@0.1.0`,
  `@theneuralledger/mcp@0.1.0`, and `@theneuralledger/cli@0.1.0`.
- PyPI: `tnl-intelligence==0.1.0`.
- GitHub: release `v0.1.0` with MCPB, Cursor, OpenAI, connector, JavaScript,
  Python, security, provenance, and rollback artifacts.
- GHCR: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and `:latest`.

## Current External Gates

- n8n: workflow run
  `https://github.com/bekirdag/tnl-intelligence/actions/runs/29764136294`
  built and signed a provenance statement, but npm returned `EOTP`. The current
  npm credential must be freshly authorized for publishing before the package
  can exist and the Creator Portal can verify it.
- OpenAI, Smithery, and remote Cursor installation: the configured endpoint
  `https://mcp.theneuralledger.com/mcp` does not resolve. OpenAI publication also
  requires a working production MCP endpoint and publisher verification.
- Zapier and Pipedream: the accounts exist, but neither platform has a registered
  TNL app/integration or a deployed live version.
- Cursor: the account and candidate exist, but the publisher application has not
  been submitted.
- Activepieces, Dify, APIs.guru, Docker MCP Catalog, and other contribution
  channels require a platform-specific artifact and/or reviewed upstream pull
  request. GitHub authentication alone does not make an absent artifact ready.
- Vendor terms, CC0 dedication, billing, DNS, and organization ownership remain
  owner-controlled decisions even when submission technically uses GitHub.

## Validation Evidence

- `npm whoami` returns `bekirdag`.
- `npm org ls theneuralledger --json` identifies `bekirdag` as owner.
- `gh auth status` confirms the existing `bekirdag` GitHub identity.
- The distribution guide has no dependency-graph edges; it is documentation-only.
- Direct n8n package tests passed, strict n8n lint passed, and the TypeScript
  build passed.
- `npm pack --dry-run --json` in `integrations/n8n` produced an
  18-entry, 96,748-byte candidate.
- The OpenAI candidate passes the current plugin manifest validator.
- Public GitHub topics now include 18 accurate TNL discovery classifications.
- Prettier accepts the strategy, plan, and progress documents.
- npm registry metadata, the PyPI JSON API, GitHub Release/API metadata, and the
  GHCR manifest verify the canonical public artifacts. The npm website rejects
  automated `curl` requests with `403`, so registry metadata is the package
  availability authority for this audit.
