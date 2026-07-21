# TNL Distribution Publication Audit Progress

Date: 2026-07-21
Status: In progress — repository publication is complete; marketplace reviews and external policy gates remain
Plan: [TNL Distribution Publication Audit Plan](tnl-distribution-publication-audit-plan.md)

## Workstream Progress

| Workstream                             | Status          | Evidence or next gate                                                                                            |
| -------------------------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------- |
| Public registry reconciliation         | Complete        | Four npm packages and `tnl-intelligence==0.1.0` verified from their public registries                            |
| GitHub Release and GHCR reconciliation | Complete        | Public `v0.1.0` release and container package verified                                                           |
| Autonomous publication boundary        | Complete        | All actions possible without identity, root, review, or usage attestations were completed and rechecked          |
| Repository-owned discovery publication | Complete        | Added and publicly verified 18 accurate GitHub topics                                                            |
| Official MCP Registry                  | Published       | `com.theneuralledger/intelligence@0.1.0` is active                                                               |
| Postman                                | Published       | Public workspace and 25-request collection verified                                                              |
| Glama                                  | Published       | Public listing is live; Google publisher account created, but GitHub ownership claim and ingestion repair remain |
| n8n community node                     | Awaiting video  | `0.1.4` is public with SLSA provenance; automated review passed and manual review awaits the required demo video |
| OpenAI plugin                          | Built           | Candidate passes validation; submission is blocked on owner identity verification                                |
| Zapier integration                     | Private beta    | App `244155` version `1.0.1` is deployed; public review is gated by required live-user usage                     |
| Pipedream app/components               | Requested       | Public app request `PipedreamHQ/pipedream#21430` is open pending an assigned app slug/directory                  |
| Cursor plugin                          | Under review    | Publisher application submitted; marketplace approval is pending                                                 |
| Smithery                               | Blocked         | Release exists; public server-card path is blocked by the root-owned live nginx allowlist                        |
| PulseMCP                               | Await ingestion | Official-registry entry is not visible yet; PulseMCP documents weekly processing                                 |
| Distribution strategy update           | In progress     | Correcting qualified-versus-published language and recording external evidence                                   |

## Verified Public Baseline

- npm: `@theneuralledger/sdk@0.1.0`, `@theneuralledger/research@0.1.0`,
  `@theneuralledger/mcp@0.1.0`, and `@theneuralledger/cli@0.1.0`.
- PyPI: `tnl-intelligence==0.1.0`.
- GitHub: release `v0.1.0` with MCPB, Cursor, OpenAI, connector, JavaScript,
  Python, security, provenance, and rollback artifacts.
- GHCR: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and `:latest`.

## Current External Gates

- n8n: `n8n-nodes-tnl-intelligence@0.1.4` is published from the dedicated
  `bekirdag/n8n-nodes-tnl-intelligence` repository with SLSA provenance. The
  Creator Portal automated review is complete. Manual review cannot be
  submitted until an uncut demo video shows installation, credential testing,
  common operations, and one AI-agent tool invocation.
- Glama: the public listing is live at
  `https://glama.ai/mcp/servers/bekirdag/tnl-intelligence`. A Glama publisher
  account was created with the available Google identity, but claiming the
  listing requires a GitHub web login as repository owner. Until claimed, Glama
  reports the public README as missing, has not inspected the six tools, and
  disables installation even though the repository and raw README return `200`.
- Smithery: the production service contains a static MCP server card, but the
  root-owned live nginx allowlist has not yet been updated to proxy
  `/.well-known/mcp/server-card.json`; Smithery scanning remains paused until
  that route returns `200` publicly.
- OpenAI: the app candidate is built and validated, but **Create plugin → With
  MCP** is blocked before draft creation by OpenAI's legal
  identity-verification flow.
- Pipedream: the public app request is open at
  `https://github.com/PipedreamHQ/pipedream/issues/21430`; component submission
  depends on Pipedream assigning the canonical app slug/directory.
- Cursor: the publisher application was submitted on 2026-07-21 with the public
  plugin repository and designated TNL logo. The portal returned **Thanks for
  applying**; marketplace approval is pending. No review/rejection email is
  present, and the portal exposes a fresh form rather than a status page, so a
  duplicate application was not created.
- Zapier: app `244155` version `1.0.1` is privately deployed with all publication
  forms complete. Public review remains gated by live-operation evidence and
  Zapier's minimum of three users with live Zaps. TNL's Keycloak `VERIFY_EMAIL`
  action currently errors, preventing a newly created internal test account from
  creating the API key needed for the first live Zapier connection.
- PulseMCP: directory search returns zero TNL results. Its submission page says
  official-registry entries are ingested daily and processed weekly, and it does
  not accept a separate submission for a server already in the official
  registry. Recheck after 2026-07-27.
- Activepieces, Dify, APIs.guru, Docker MCP Catalog, and other contribution
  channels require a platform-specific artifact and/or reviewed upstream pull
  request. GitHub authentication alone does not make an absent artifact ready.
- Vendor terms, CC0 dedication, billing, DNS, and organization ownership remain
  owner-controlled decisions even when submission technically uses GitHub.

## Minimal Owner Actions

1. **Smithery root deploy:** the exact reviewed nginx candidate from commit
   `ed7c919` is already uploaded to Wodomini as
   `~/tnl-mcp.conf.candidate` (SHA-256
   `d5f5c079cdd42be938eb1ddecbfb0bd2a1f057beee100ae619d16f3eaefc0b2b`).
   Run:

   ```bash
   ssh wodomini
   sudo cp -a /etc/nginx/sites-available/tnl-mcp.conf /etc/nginx/sites-available/tnl-mcp.conf.bak-smithery-20260721
   sudo install -o root -g root -m 0644 ~/tnl-mcp.conf.candidate /etc/nginx/sites-available/tnl-mcp.conf
   sudo nginx -t
   sudo systemctl reload nginx
   ```

   After this succeeds, the agent can verify the route, resume the Smithery
   scan, and run the clean-account install/tool test.

2. **Glama ownership:** sign in to GitHub as `bekirdag` in the in-app browser.
   The Glama claim dialog is ready; the agent can finish claiming and repairing
   the listing after GitHub authentication exists.
3. **OpenAI identity:** complete individual or business verification for **The
   Neural Ledger** organization. The agent can then create and complete the MCP
   plugin draft.
4. **n8n video:** record the portal-prescribed uncut demo (five minutes or less)
   using a working TNL credential. The agent can upload the finished file/link
   and submit manual review.
5. **Zapier usage:** provide three genuine users with live TNL Zaps and a working
   reviewer credential. The agent must not attest that the publication
   requirements are met before this evidence exists.

No owner action is currently useful for Cursor, Pipedream, or PulseMCP: those
channels are waiting on marketplace review, an upstream app slug, and weekly
registry ingestion respectively.

## Validation Evidence

- `npm whoami` returns `bekirdag`.
- `npm org ls theneuralledger --json` identifies `bekirdag` as owner.
- `gh auth status` confirms the existing `bekirdag` GitHub identity.
- The distribution guide has no dependency-graph edges; it is documentation-only.
- Direct n8n package tests passed, strict n8n lint passed, and the TypeScript
  build passed.
- GitHub Actions run `29785976751` published
  `n8n-nodes-tnl-intelligence@0.1.4` with SLSA provenance from dedicated-repo
  commit `de0f266`; monorepo commit `ecf6492` carries the same credential-test
  fix.
- npm registry metadata confirms `0.1.4`, the dedicated repository, controlled
  author email, and the SLSA provenance attestation URL.
- The n8n Creator Portal accepted ownership, passed automated review, and now
  shows **Manual Review — Awaiting Video**.
- The Glama review/indexing step completed and the listing is publicly
  reachable. Google sign-in created a usable publisher account; the remaining
  claim flow specifically requires GitHub authentication.
- Cursor returned **Thanks for applying** after submission with organization
  `The Neural Ledger`, namespace `theneuralledger`, public repository, website,
  contact, description, and the designated logo added in commit `1a55271`.
- OpenAI's plugin portal displayed **Complete identity verification** immediately
  after selecting **Create plugin → With MCP**, confirming verification blocks
  draft creation as well as submission.
- Pipedream issue `PipedreamHQ/pipedream#21430` remains open with no comments.
- The public MCP hosts return the expected `401` authentication challenge, while
  the Smithery server-card URL still returns `404`; the Smithery registry URL
  also returns **404: Server Not Found or Removed**.
- Postman's public workspace returns `200`; the official MCP Registry search
  returns `com.theneuralledger/intelligence@0.1.0`; all four npm packages,
  `n8n-nodes-tnl-intelligence@0.1.4`, PyPI `tnl-intelligence==0.1.0`, GitHub
  release `v0.1.0`, and the GHCR `0.1.0` manifest remain public.
- `npm pack --dry-run --json` in `integrations/n8n` produced an
  18-entry, 96,748-byte candidate.
- The OpenAI candidate passes the current plugin manifest validator.
- Public GitHub topics now include 18 accurate TNL discovery classifications.
- Prettier accepts the strategy, plan, and progress documents.
- npm registry metadata, the PyPI JSON API, GitHub Release/API metadata, and the
  GHCR manifest verify the canonical public artifacts. The npm website rejects
  automated `curl` requests with `403`, so registry metadata is the package
  availability authority for this audit.
