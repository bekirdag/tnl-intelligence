# TNL Intelligence GitHub and GHCR Release Progress

Date: 2026-07-19
Status: Complete
Plan: [TNL Intelligence GitHub and GHCR Release Plan](tnl-github-ghcr-release-plan.md)
Release: `v0.1.0`

## Authorization

- The repository owner explicitly authorized continuation of the proposed
  commit, push, GitHub Release, and GHCR publication path on 2026-07-19.
- npm, PyPI, MCP Registry, hosted service deployment, and marketplace promotion
  remain outside this authorization because their owner-side credentials or
  environments are absent.

## Progress

| Phase               | Status   | Evidence                                                                                   |
| ------------------- | -------- | ------------------------------------------------------------------------------------------ |
| Release audit       | Complete | GitHub admin access confirmed; npm/PyPI/MCP/production blockers recorded                   |
| Release planning    | Complete | Execution, validation, asset, and rollback plan documented                                 |
| Tree preparation    | Complete | Tools 01-10 tree reviewed; release notes, runbook, and rollback finalized                  |
| Local qualification | Complete | Clean candidate `tnl-rc-1419d34aba032124`; seven technical gates passed                    |
| Source publication  | Complete | `main` pushed; annotated `v0.1.0` tag resolves to qualified commit `2afb198`               |
| GitHub Release      | Complete | Public non-prerelease release created with 25 qualified assets                             |
| GHCR publication    | Complete | Public image tags share the published digest; authenticated and anonymous smoke tests pass |
| Evidence closeout   | Complete | Immutable identifiers, checks, and remaining external gates recorded                       |

## Initial Evidence

- Local and remote `main` both began at
  `b14320963cdec44aa51753393071a25cb864b345`.
- No existing Git tags or GitHub Releases were present.
- The working tree contained 26 tracked modifications and 61 untracked entries
  representing the completed Tools 01-10 implementation.
- The previously qualified dirty-tree candidate was
  `tnl-rc-5df0acfcdb190bda` with source digest
  `586d47bc948920133ef98c1f210a0070dbb3641c7befe9958af22f5c66ecd45c`.
- The candidate contained 25 package surfaces, 8 contracts, and 51 qualified
  artifacts; all seven technical gates passed.
- The GHCR workflow publishes immutable `0.1.0` and convenience `latest` tags
  using repository `GITHUB_TOKEN` package-write permission.
- Docdex impact analysis found no inbound or outbound dependencies for the
  release documentation or container workflow; impact diagnostics found no
  unresolved imports.

## Validation Trail

| Check                           | Result | Evidence                                                                                                                      |
| ------------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------- |
| Repository workspace tests      | Pass   | `docdexd run-tests --repo .`; all configured workspace test suites passed                                                     |
| Aggregate release qualification | Pass   | `npm run qualify:release`; six scenarios and seven technical gates passed                                                     |
| Candidate integrity             | Pass   | Clean candidate `tnl-rc-1419d34aba032124` from commit `2afb19864891575f825cd5f552e84d4703b554a8`                              |
| Production dependency audit     | Pass   | Zero npm production vulnerabilities                                                                                           |
| Secret and privacy scans        | Pass   | No credential/private-key material or high/critical privacy blocker found                                                     |
| Container qualification         | Pass   | Non-root runtime, multi-architecture build, SBOM, and scan evidence passed                                                    |
| Rollback and recovery           | Pass   | Capacity/chaos and rollback rehearsals passed                                                                                 |
| Staged semantic validation      | Pass   | All 431 staged files passed `/v1/hooks/validate` in 11 bounded batches; the single-request CLI exceeded the daemon body limit |

## Publication Evidence

- Qualified source and annotated tag: `2afb19864891575f825cd5f552e84d4703b554a8`
  and `v0.1.0`.
- Clean source digest: `897732633c3e0d1fe8b517a337d4f608e43044ce7b4462100886eec7c38b19ec`.
- Green source CI: https://github.com/bekirdag/tnl-intelligence/actions/runs/29681636655.
- Public GitHub Release: https://github.com/bekirdag/tnl-intelligence/releases/tag/v0.1.0
  with 25 attached artifacts and evidence records.
- GHCR publication run: https://github.com/bekirdag/tnl-intelligence/actions/runs/29682005073,
  dispatched from `v0.1.0`.
- Published image tags: `ghcr.io/bekirdag/tnl-intelligence:0.1.0` and
  `ghcr.io/bekirdag/tnl-intelligence:latest`.
- Registry digest:
  `sha256:698798ed42d2045cc17d103ee38796d1e30a10546cb23d28f60784e710e3cf24`.
- Authenticated pull and runtime verification:
  https://github.com/bekirdag/tnl-intelligence/actions/runs/29682150454; the
  image runs read-only as `node`, `/healthz` passes, and an unauthenticated
  `/mcp` POST returns `401`.
- Anonymous pull verification resolves the same digest. The public image runs
  read-only as `node`, returns the expected `/healthz` payload, and rejects an
  unauthenticated `/mcp` POST with `401`.

## Remaining External Gates

| Channel         | Blocker                                                                                 |
| --------------- | --------------------------------------------------------------------------------------- |
| npm             | Local auth returns `E401`; trusted publishers and protected environment absent          |
| PyPI            | Trusted publisher and protected environment absent                                      |
| MCP Registry    | DNS signing key/environment absent and npm publication required first                   |
| Hosted services | Production identity, secrets, TLS, durable stores, and deployment context absent        |
| Marketplaces    | Provider accounts, callback registration, live canaries, and review submission required |

## Rollback State

- No production runtime or database is changed by this release.
- Git history will remain append-only.
- The immutable container tag provides release evidence; `latest` can be moved
  to a validated patch release if rollback is needed.
