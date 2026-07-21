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
| Glama                                  | Claimed         | Public listing is live and verified-maintainer ownership is confirmed; Glama's repository sync remains stuck     |
| n8n community node                     | Awaiting video  | `0.1.4` is public with SLSA provenance; automated review passed and manual review awaits the required demo video |
| OpenAI plugin                          | Built           | Candidate passes validation; submission is blocked on owner identity verification                                |
| Zapier integration                     | Private beta    | App `244155` version `1.0.1` is deployed; public review is gated by required live-user usage                     |
| Pipedream app/components               | Requested       | Public app request `PipedreamHQ/pipedream#21430` is open pending an assigned app slug/directory                  |
| Cursor plugin                          | Under review    | Publisher application submitted; marketplace approval is pending                                                 |
| Smithery                               | Published       | Release `2ad569ce-2c09-4bfc-bc3f-bbe93681edf0` deployed; public listing exposes all six OAuth tools              |
| PulseMCP                               | Await ingestion | Official-registry entry is not visible yet; PulseMCP documents weekly processing                                 |
| Distribution strategy update           | In progress     | Correcting qualified-versus-published language and recording external evidence                                   |

## Verified Public Baseline

- npm: `@theneuralledger/sdk@0.1.0`, `@theneuralledger/research@0.1.0`,
  `@theneuralledger/mcp@0.1.0`, and `@theneuralledger/cli@0.1.0`.
- PyPI: `tnl-intelligence==0.1.0`.
- GitHub: release `v0.1.0` with MCPB, Cursor, OpenAI, connector, JavaScript,
  Python, security, provenance, and rollback artifacts.
- GHCR: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and `:latest`.

## Post-Audit Publication Updates

- On 2026-07-21, Zapier private version `1.0.3` was deployed after all 28 CLI
  checks passed without warnings. Production-server canaries pass for the
  connector's searches, actions, research workflows, and triggers using the
  connected account recorded in `ACCOUNTS.md`.
- On 2026-07-21, the Docker MCP Catalog entry was validated, built, exercised
  through Docker Desktop MCP Toolkit, and submitted as
  [docker/mcp-registry#4503](https://github.com/docker/mcp-registry/pull/4503).
  Docker dynamically discovered all six read-only tools and a live
  `tnl_research_what_changed` invocation passed.
- Docker's remaining submission input is a dedicated reviewer API key shared
  through its private credential form; do not place that credential in the pull
  request or repository.

## Current External Gates

- n8n: `n8n-nodes-tnl-intelligence@0.1.4` is published from the dedicated
  `bekirdag/n8n-nodes-tnl-intelligence` repository with SLSA provenance. The
  Creator Portal automated review is complete. Manual review cannot be
  submitted until an uncut demo video shows installation, credential testing,
  common operations, and one AI-agent tool invocation.
- Glama: the public listing is live at
  `https://glama.ai/mcp/servers/bekirdag/tnl-intelligence`. The existing
  `bekir@piyote.com` account owns the listing, Glama displays its verified-
  maintainer badge, and the server admin panel is available. A manual repository
  sync was started on 2026-07-21, but Glama remains stuck at **Sync in Progress**
  with no commit data. It therefore still reports the README as missing, has not
  inspected the six tools, and disables installation even though the repository
  and raw README both return `200`. A repair request containing that evidence was
  sent to `support@glama.ai` from the publisher mailbox on 2026-07-21.
- Smithery: the root-owned nginx candidate was installed and reloaded after a
  successful configuration test. The public server card now returns `200` with
  all six tools. Fresh external release
  `2ad569ce-2c09-4bfc-bc3f-bbe93681edf0` completed Smithery discovery, metadata
  generation, and deployment. The public listing is visible at
  `https://smithery.ai/servers/theneuralledger/tnl-intelligence`, exposes all six
  tools, and includes the canonical description, homepage, and repository. The
  server also appears in Smithery CLI search with its canonical connection URL.
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

1. **OpenAI identity:** complete individual or business verification for **The
   Neural Ledger** organization. The agent can then create and complete the MCP
   plugin draft.
2. **n8n video:** record the portal-prescribed uncut demo (five minutes or less)
   using a working TNL credential. The agent can upload the finished file/link
   and submit manual review.
3. **Zapier usage:** provide three genuine users with live TNL Zaps and a working
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
- The Glama listing is publicly reachable, owned by the existing
  `bekir@piyote.com` account, and marked with Glama's verified-maintainer badge.
  The admin panel accepted a manual repository sync, but the job remained in
  progress with no commit data; GitHub and raw `main/README.md` both returned
  `200`, isolating the remaining defect to Glama ingestion. Gmail confirmed the
  repair request to `support@glama.ai` was sent.
- Cursor returned **Thanks for applying** after submission with organization
  `The Neural Ledger`, namespace `theneuralledger`, public repository, website,
  contact, description, and the designated logo added in commit `1a55271`.
- OpenAI's plugin portal displayed **Complete identity verification** immediately
  after selecting **Create plugin → With MCP**, confirming verification blocks
  draft creation as well as submission.
- Pipedream issue `PipedreamHQ/pipedream#21430` remains open with no comments.
- The public MCP hosts return the expected `401` authentication challenge and
  the server-card URL returns `200` with six tools. Smithery release
  `2ad569ce-2c09-4bfc-bc3f-bbe93681edf0` completed successfully; its public
  server page returns `200`, the hosted MCP endpoint returns the expected Bearer
  challenge, and protected-resource metadata returns `200`. The portal lists all
  six tools, public visibility, homepage, repository, and a 65/100 profile score;
  Smithery CLI search returns `theneuralledger/tnl-intelligence` with its public
  connection URL.
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
