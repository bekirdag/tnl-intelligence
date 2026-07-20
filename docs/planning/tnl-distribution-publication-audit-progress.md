# TNL Distribution Publication Audit Progress

Date: 2026-07-20
Status: Complete
Plan: [TNL Distribution Publication Audit Plan](tnl-distribution-publication-audit-plan.md)

## Workstream Progress

| Workstream                             | Status   | Evidence or next gate                                                                                         |
| -------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------------- |
| Public registry reconciliation         | Complete | Four npm packages and `tnl-intelligence==0.1.0` verified from their public registries                         |
| GitHub Release and GHCR reconciliation | Complete | Public `v0.1.0` release and container package verified                                                        |
| Autonomous publication boundary        | Complete | Existing identities and every account, terms, DNS, artifact, and review gate classified                       |
| Repository-owned discovery publication | Complete | Added and publicly verified 18 accurate GitHub topics                                                         |
| Qualified n8n package publication      | Blocked  | Qualification passes, but a compliant initial provenance/trusted-publisher bootstrap is required              |
| Distribution strategy update           | Complete | Added canonical URLs, current statuses, and remaining owner gates                                             |
| Validation, commit, and push           | Complete | Formatting, registry/API verification, Docdex diagnostics, pre-commit, commit, and remote verification passed |

## Verified Public Baseline

- npm: `@theneuralledger/sdk@0.1.0`, `@theneuralledger/research@0.1.0`,
  `@theneuralledger/mcp@0.1.0`, and `@theneuralledger/cli@0.1.0`.
- PyPI: `tnl-intelligence==0.1.0`.
- GitHub: release `v0.1.0` with MCPB, Cursor, OpenAI, connector, JavaScript,
  Python, security, provenance, and rollback artifacts.
- GHCR: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and `:latest`.

## Current External Gates

- Official MCP Registry: the published npm package uses
  `com.theneuralledger/intelligence`; publication therefore requires the
  `theneuralledger.com` DNS verification key and GitHub environment.
- Smithery, Postman, Pipedream, Apify, Cursor, Zapier, and similar hosted
  marketplaces require a vendor account, OAuth grant, or API identity that is
  not configured on this machine.
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
- `docdexd run-tests --target integrations/n8n` passed all discovered workspace
  tests, including the n8n metadata test.
- `npm run lint --workspace n8n-nodes-tnl-intelligence` passed strict n8n lint.
- `npm run build --workspace n8n-nodes-tnl-intelligence` passed.
- `npm pack --workspace n8n-nodes-tnl-intelligence --dry-run --json` produced an
  18-entry, 96,748-byte candidate.
- `npm run prepublishOnly --workspace n8n-nodes-tnl-intelligence` correctly
  refused direct publication and exposed the missing supported release flow.
- Public GitHub topics now include 18 accurate TNL discovery classifications.
- Prettier accepts the strategy, plan, and progress documents.
- npm registry metadata, the PyPI JSON API, GitHub Release/API metadata, and the
  GHCR manifest verify the canonical public artifacts. The npm website rejects
  automated `curl` requests with `403`, so registry metadata is the package
  availability authority for this audit.
