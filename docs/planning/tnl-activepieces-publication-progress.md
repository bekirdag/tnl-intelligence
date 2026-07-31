# TNL Activepieces Publication Progress

Date: 2026-07-31
Status: In progress
Plan: [TNL Activepieces Publication Plan](tnl-activepieces-publication-plan.md)

## Workstream Progress

| Workstream                          | Status                               | Evidence or next gate                                                                                                                                                              |
| ----------------------------------- | ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Standalone package qualification    | Complete                             | Six actions, tests, typecheck, build, package inspection, clean consumer install, and Activepieces runtime loading passed                                                          |
| npm publication                     | Complete                             | `@theneuralledger/piece-tnl-intelligence@0.1.2` is public and contains Activepieces' required `src/index.js` runtime entrypoint                                                    |
| npm trusted publishing              | Complete                             | GitHub Actions workflow `release-activepieces.yml` is bound through npm OIDC trusted publishing                                                                                    |
| Upstream requirement reconciliation | Complete                             | Current upstream `CONTRIBUTING.md` pauses unsolicited external pull requests and directs external publishers to public npm community pieces                                        |
| Upstream pull request               | Blocked by upstream policy           | `bekirdag/activepieces` is synchronized, but a PR would be auto-closed unless Activepieces confirms an existing customer/Slack discussion and applies `keep-open`                  |
| Live Activepieces runtime canary    | Partial — 4/6 passed                 | Search, record lookup, recent changes, and entity exposure returned live structured production data; both MCP-backed research actions fail while the public MCP hostname times out |
| Official discovery                  | Public community-piece path complete | Activepieces CE installed `0.1.2` directly from npm; upstream catalog inclusion remains unavailable under the current contribution pause                                           |

## Validation Evidence

- npm reports `@theneuralledger/piece-tnl-intelligence@0.1.2` as the current
  public version. The tarball exposes `src/index.js`, which Activepieces imports
  for community-piece metadata extraction.
- npm trusted publisher ID `244c5abf-cb1d-4e5b-b089-9abbce207af7` binds
  `bekirdag/tnl-intelligence`, `.github/workflows/release-activepieces.yml`, and
  environment `npm` with publish permission.
- Release workflow run
  [30629195287](https://github.com/bekirdag/tnl-intelligence/actions/runs/30629195287)
  passed checkout, npm 12 install, dependency install, typecheck, eight tests,
  build, tarball inventory, tag/version matching, and OIDC publication.
- Activepieces CE installed the exact public `0.1.2` package and extracted all
  six read-only actions. Its secret store validated the TNL connection without
  exposing the credential.
- Live bounded canaries passed for `search_intelligence`, `get_intelligence`,
  `list_recent_changes`, and `get_exposure`. Outputs included stable record IDs,
  citations/claims, pagination, revision metadata, and entity exposure data.
- `run_research` and `get_weekly_edition` both reached the installed package but
  failed at the external MCP dependency. Independent eight-second probes of
  `/healthz`, `/readyz`, and `/mcp` all returned connection timeout with no HTTP
  response on 2026-07-31.
- Local runtime data is isolated at
  `/Users/bekirdag/Documents/apps/.tnl-activepieces-canary-data-v2`; no secret is
  recorded in this progress document or Git history.

## Current Blockers

- Restore external reachability for `https://mcp.theneuralledger.com`; then
  rerun the two configured research steps to complete the six-action canary.
- Do not open an unsolicited upstream Activepieces pull request while the
  contribution pause remains. Proceed only if Activepieces confirms the TNL
  contribution is whitelisted or the policy changes.
