# TNL Distribution Publication Audit Progress

Date: 2026-07-21
Status: In progress — repository publication is complete; marketplace reviews and external policy gates remain
Plan: [TNL Distribution Publication Audit Plan](tnl-distribution-publication-audit-plan.md)

## Workstream Progress

| Workstream                             | Status       | Evidence or next gate                                                                                   |
| -------------------------------------- | ------------ | ------------------------------------------------------------------------------------------------------- |
| Public registry reconciliation         | Complete     | Four npm packages and `tnl-intelligence==0.1.0` verified from their public registries                   |
| GitHub Release and GHCR reconciliation | Complete     | Public `v0.1.0` release and container package verified                                                  |
| Autonomous publication boundary        | In progress  | Created accounts are now available; marketplace and deployment state is being re-audited                |
| Repository-owned discovery publication | Complete     | Added and publicly verified 18 accurate GitHub topics                                                   |
| Official MCP Registry                  | Published    | `com.theneuralledger/intelligence@0.1.0` is active                                                      |
| Postman                                | Published    | Public workspace and 25-request collection verified                                                     |
| Glama                                  | Under review | Repository submitted on 2026-07-20                                                                      |
| n8n community node                     | Under review | `0.1.2` is public with SLSA provenance; ownership passed and automated Creator Portal review is running |
| OpenAI plugin                          | Built        | Candidate passes validation; submission is blocked on owner identity verification                       |
| Zapier integration                     | Private beta | App `244155` version `1.0.1` is deployed; public review is gated by required live-user usage            |
| Pipedream app/components               | Requested    | Public app request `PipedreamHQ/pipedream#21430` is open pending an assigned app slug/directory         |
| Cursor plugin                          | Under review | Publisher application submitted; marketplace approval is pending                                        |
| Smithery                               | Blocked      | Release exists; public server-card path is blocked by the root-owned live nginx allowlist               |
| Distribution strategy update           | In progress  | Correcting qualified-versus-published language and recording external evidence                          |

## Verified Public Baseline

- npm: `@theneuralledger/sdk@0.1.0`, `@theneuralledger/research@0.1.0`,
  `@theneuralledger/mcp@0.1.0`, and `@theneuralledger/cli@0.1.0`.
- PyPI: `tnl-intelligence==0.1.0`.
- GitHub: release `v0.1.0` with MCPB, Cursor, OpenAI, connector, JavaScript,
  Python, security, provenance, and rollback artifacts.
- GHCR: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and `:latest`.

## Current External Gates

- n8n: `n8n-nodes-tnl-intelligence@0.1.2` is published with provenance and the
  Creator Portal submission passed ownership verification. Automated review is
  in progress; manual review follows if the automated checks pass.
- Smithery: the production service contains a static MCP server card, but the
  root-owned live nginx allowlist has not yet been updated to proxy
  `/.well-known/mcp/server-card.json`; Smithery scanning remains paused until
  that route returns `200` publicly.
- OpenAI: the app candidate is built and validated, but submission requires the
  organization owner to complete OpenAI's legal identity-verification flow.
- Pipedream: the public app request is open at
  `https://github.com/PipedreamHQ/pipedream/issues/21430`; component submission
  depends on Pipedream assigning the canonical app slug/directory.
- Cursor: the publisher application was submitted and is awaiting marketplace
  approval.
- Zapier: app `244155` version `1.0.1` is privately deployed with all publication
  forms complete. Public review remains gated by live-operation evidence and
  Zapier's minimum of three users with live Zaps. TNL's Keycloak `VERIFY_EMAIL`
  action currently errors, preventing a newly created internal test account from
  creating the API key needed for the first live Zapier connection.
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
- GitHub Actions run `29784486908` published
  `n8n-nodes-tnl-intelligence@0.1.2` with SLSA provenance from commit `2fb7e0c`.
- npm registry metadata confirms `0.1.2` as `latest`, the controlled author
  email, and the provenance attestation URL.
- The n8n Creator Portal accepted the package ownership token and started its
  automated review.
- `npm pack --dry-run --json` in `integrations/n8n` produced an
  18-entry, 96,748-byte candidate.
- The OpenAI candidate passes the current plugin manifest validator.
- Public GitHub topics now include 18 accurate TNL discovery classifications.
- Prettier accepts the strategy, plan, and progress documents.
- npm registry metadata, the PyPI JSON API, GitHub Release/API metadata, and the
  GHCR manifest verify the canonical public artifacts. The npm website rejects
  automated `curl` requests with `403`, so registry metadata is the package
  availability authority for this audit.
