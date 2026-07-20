# TNL Live Service and Release Validation Progress

Date: 2026-07-20
Status: Complete with authentication blocker
Plan: [TNL Live Service and Release Validation Plan](tnl-live-service-release-validation-plan.md)

## Workstream Progress

| Workstream | Status | Evidence or next gate |
| --- | --- | --- |
| Public baseline and repository truth | Complete | npm, PyPI, and GitHub Release expose immutable `0.1.0` artifacts |
| Live account and API validation | Blocked | Supplied test identity is rejected by the production SSO endpoint; no key was created or stored |
| Public package qualification | Complete | Clean npm/PyPI/CLI/MCP installs pass; published container runtime passes on amd64 |
| Account-backed integration validation | Blocked | Repository and clean-consumer validation passes; live API-key-backed checks await valid test access |
| Repair and release | Complete | GHCR now publishes verified amd64 plus arm64 images; the live API now serves the static sample contract |
| Final public verification | Complete | Immutable package versions, multi-architecture image, hosted OpenAPI, and public sample endpoint verified |

## Validation Evidence

- Repository root: `/Users/bekirdag/Documents/apps/tnl-intelligence`.
- Current branch: `main`.
- Current commit: `c017b54 docs: reconcile distribution publication status`.
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
- Production SSO returned `Invalid username or password` for the supplied test
  identity. The rejected secret was not recorded, and no API key was created.
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
