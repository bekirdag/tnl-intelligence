# TNL Live Service and Release Validation Progress

Date: 2026-07-20
Status: In progress
Plan: [TNL Live Service and Release Validation Plan](tnl-live-service-release-validation-plan.md)

## Workstream Progress

| Workstream | Status | Evidence or next gate |
| --- | --- | --- |
| Public baseline and repository truth | Complete | npm, PyPI, and GitHub Release expose immutable `0.1.0` artifacts; `main` remains at `c017b54` |
| Live account and API validation | Blocked | Supplied test identity is rejected by the production SSO endpoint; no key was created or stored |
| Public package qualification | Complete | Clean npm/PyPI/CLI/MCP installs pass; published container runtime passes on amd64 |
| Account-backed integration validation | In progress | Repository and clean-consumer validation passes; live API-key-backed checks await valid test access |
| Repair and release | In progress | GHCR workflow corrected to publish and verify amd64 plus arm64 |
| Final public verification | Pending | Verify exact immutable versions and public service endpoints |

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
