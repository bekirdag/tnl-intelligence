# TNL Live Service and Release Validation Progress

Date: 2026-07-20
Status: Complete with one production infrastructure gate
Plan: [TNL Live Service and Release Validation Plan](tnl-live-service-release-validation-plan.md)

## Workstream Progress

| Workstream                            | Status   | Evidence or next gate                                                                                                            |
| ------------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------- |
| Public baseline and repository truth  | Complete | npm, PyPI, and GitHub Release expose immutable `0.1.0` artifacts                                                                 |
| Live account and API validation       | Complete | Signed-in member session created one temporary key; authenticated canaries passed and the key was revoked                        |
| Public package qualification          | Complete | Clean npm/PyPI/CLI/MCP installs pass; published container runtime passes on amd64                                                |
| Account-backed integration validation | Complete | Published SDKs, CLI, MCP, n8n, Pipedream, Zapier, and connector core passed against production                                   |
| Repair and release                    | Complete | API query, Zapier null-parameter, GHCR architecture, sample contract, and market-provider defects are repaired and deployed      |
| Final public verification             | Gated    | All non-AI routes pass; `/v1/ai-terminal` still falls through nginx's 30-second proxy block and needs a root-owned location rule |

## Validation Evidence

- Repository root: `/Users/bekirdag/Documents/apps/tnl-intelligence`.
- Current branch: `main`.
- Tools repository validation commit: `7e8c62b Fix Zapier optional query parameters`.
- Existing worktree changes were identified before validation and will be
  preserved.
- Secrets supplied for live testing are intentionally omitted from this record.
- npm publishes `0.1.0` for `@theneuralledger/sdk`,
  `@theneuralledger/research`, `@theneuralledger/mcp`, and
  `@theneuralledger/cli`; registry metadata includes tarball integrity.
- PyPI publishes `tnl-intelligence==0.1.0` as both a wheel and source archive
  with recorded package hashes.
- GitHub Release `v0.1.0` is public and contains the SDK, package, connector,
  integration, SBOM, and provenance assets expected by the release plan.
- Local publishable package manifests remain aligned at `0.1.0`; no version
  mutation is justified by the baseline alone.
- A signed-in production member session created one clearly labeled temporary
  API key. The key value was never written to the repository or this report,
  and it was revoked after validation; a final `/v1/me` probe returned `401`.
- A clean npm consumer installed the four public packages at `0.1.0`; SDK and
  research imports, CLI help, and package metadata passed.
- The public MCP package negotiated eight read-only tools, three resource
  templates, and two prompts over stdio.
- A clean PyPI virtual environment installed `tnl-intelligence==0.1.0`, passed
  `pip check`, imported the sync/async SDK, and exposed the `tnl-quant` CLI.
- The published GHCR amd64 image runs as `node` under a read-only filesystem,
  returns `200` from `/healthz`, and rejects unauthenticated `/mcp` with `401`.
- Registry inspection found a release defect: the GHCR manifest lacked
  `linux/arm64` even though the generated catalog promises amd64 and arm64.
- `.github/workflows/release-container.yml` now publishes both target
  platforms. `.github/workflows/verify-container.yml` now fails unless both
  platforms exist before performing the runtime smoke test.
- Distribution artifact qualification, Cursor/OpenAI adapter qualification,
  n8n/Pipedream/Zapier connector qualification, Zapier's 28 platform checks,
  and all 40 Python tests pass locally.
- GitHub Actions release run
  `https://github.com/bekirdag/tnl-intelligence/actions/runs/29756924236`
  republished `0.1.0` and `latest` as multi-architecture indexes for
  `linux/amd64` and `linux/arm64`.
- GitHub Actions verification run
  `https://github.com/bekirdag/tnl-intelligence/actions/runs/29757383328`
  passed both platform assertions and the container runtime smoke test.
- The republished `0.1.0` and `latest` tags resolve to multi-architecture
  digest `sha256:c40569e9ad52f936055c50a4e3de57e4a807db3d61c3e5a42480e73c409998cc`.
- A native arm64 pull runs as non-root under a read-only filesystem and returns
  `200` from `/healthz`.
- The hosted OpenAPI contract was stale at `2026-05-31` and omitted
  `/v1/sample/news`. The service fix was committed as `222afcb` in the
  `theneuralledger` repository and deployed to production.
- Live production now returns OpenAPI version `2026-07-18` with 24 paths and
  exposes `/v1/sample/news` without authentication. The endpoint returns two
  synthetic CC0 stories, `X-TNL-Data-Mode: static-sample`, cache headers, and
  bounded rate-limit headers without reading production member data.
- npm and PyPI were not republished because clean installs and qualification
  passed at their immutable public `0.1.0` versions; publishing identical
  versions again is neither supported nor warranted.

## Authenticated Production Evidence

- The final authenticated endpoint matrix returned `200` for `/v1/me`,
  `/v1/news`, `/v1/news-stories`, `/v1/search`, `/v1/entities`,
  `/v1/impact-paths`, `/v1/assets/NVDA/stories`, `/v1/filters`, `/v1/markets`,
  `/v1/saved-searches`, `/v1/rss`, and `/v1/atom`.
- The public JavaScript SDK passed account, news, search, entity, impact-path,
  asset, market, feed, and saved-search lifecycle canaries. The temporary saved
  search created for qualification was deleted.
- A clean PyPI virtual environment passed authenticated account, news, search,
  entity, impact-path, and market calls using `tnl-intelligence==0.1.0`.
- The published CLI passed authenticated `status`, `latest`, and `search`
  commands from a clean install.
- The published MCP server negotiated eight tools, three resource templates,
  and two prompts, then passed authenticated service-status, latest-news, and
  search calls over stdio.
- Connector core passed authenticated connection, search, and asset-exposure
  canaries. The built n8n runtime, the Pipedream action, and the corrected
  Zapier search action each returned live production results.
- Cursor and OpenAI local integrations use the same published MCP transport;
  the MCP canary validates their runtime path without storing a production key
  in a marketplace or public cloud configuration.
- Postman cloud was intentionally not given the temporary production key. The
  hosted contract and authenticated direct/SDK canaries provide the equivalent
  request-level evidence without persisting a credential in a public workspace.

## Defects Repaired During Live Qualification

- Production `/v1/impact-paths` returned MySQL
  `Incorrect arguments to mysqld_stmt_execute` because the summary query used a
  bound `LIMIT` parameter. Service commit `63ec99a` validates the limit and
  emits the bounded numeric literal; the unfiltered and filtered live routes
  now return `200`.
- Zapier serialized omitted optional inputs as `null` query parameters, causing
  `invalid_cursor`. Tools commit `7e8c62b` strips `null`, `undefined`, and empty
  values; Zapier's 28 platform checks, connector suite, build, and live search
  now pass.
- Stooq's quote endpoint began returning `404`, leaving five of six market
  quotes stale. Service commit `1dbcd21` adds Yahoo Finance as a bounded
  fallback while retaining CoinGecko for BTC. Production stored all six quotes
  in one cycle, and `/v1/markets` returned five Yahoo Finance records plus one
  CoinGecko record with the same fresh collection timestamp.

## Remaining Infrastructure Gate

- The public non-streaming `/v1/ai-terminal` request is authenticated and the
  server completes the model work, but nginx routes `/v1/*` through the general
  `proxy_read_timeout 30s` block. The app permits up to 180 seconds and the
  website's streaming `/api/ledger-ai-terminal/` route already has a dedicated
  300-second block. Production logs confirm both canary jobs completed after the
  public request had already received `504`.
- Closing this final gate requires a root-owned nginx location for
  `/v1/ai-terminal` and `/v1/ai-terminal/chat` with timeouts aligned to the
  existing 300-second terminal block, followed by `nginx -t`, reload, and one
  authenticated canary. The connected deployment user can read the config but
  cannot modify or reload it without interactive administrator authentication.
- No package version bump or registry republish is needed for this nginx-only
  correction.
