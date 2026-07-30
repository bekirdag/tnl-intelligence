# TNL Artifact Hub Container Publication Progress

Date: 2026-07-30
Status: In progress — hardened `0.1.2` candidate validated locally
Plan: [TNL Artifact Hub Container Publication Plan](tnl-artifact-hub-container-publication-plan.md)

## Workstream Progress

| Workstream                      | Status             | Evidence or next gate                                                                                                                 |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public image inspection         | Complete           | `0.1.0` index and both platform configs inspected                                                                                     |
| Architecture gate               | Complete           | `linux/amd64` and `linux/arm64` present                                                                                               |
| Provenance baseline             | Complete           | Per-platform attestation manifests present                                                                                            |
| Artifact Hub metadata gate      | Failed on `0.1.0`  | Required README/created/description annotations or labels are absent                                                                  |
| Release workflow update         | Complete           | OCI/Artifact Hub labels and index annotations, SBOM, and explicit provenance added; all static checks pass                            |
| New immutable image             | Hardening required | `0.1.1` metadata/runtime canary passed but vulnerability scan found one critical and six high findings; clean `0.1.2` candidate ready |
| Artifact Hub account/repository | Pending            | Create only after the new image passes                                                                                                |
| Verified publisher              | Pending            | Requires Artifact Hub repository ID and OCI metadata artifact                                                                         |

## Baseline Evidence

- Tag: `ghcr.io/bekirdag/tnl-intelligence:0.1.0`
- OCI index:
  `sha256:c40569e9ad52f936055c50a4e3de57e4a807db3d61c3e5a42480e73c409998cc`
- Platform manifests:
  - `linux/amd64`:
    `sha256:2e7ae8732826b866165f261340f4271664d1aa718475c440e9a3bf0b4c7749f2`
  - `linux/arm64`:
    `sha256:427b28f30e64142c273ac2501af0923bc83c13f306276addb375d9c067413a70`
- Both configs declare `User=node`, port `7317`, the HTTP MCP entrypoint, and
  the `/healthz` health check.
- The index contains provenance attestation manifests but no Artifact Hub
  package annotations.
- The platform image configs contain no OCI labels.

## Planning Evidence

- Docdex impact analysis found no inbound or outbound dependency edges for
  `.github/workflows/release-container.yml`.
- Docdex AST inspection reported `unsupported_language` for GitHub Actions YAML;
  the change will therefore use YAML/action validation and live workflow evidence
  instead of claiming AST coverage.
- Current Artifact Hub documentation confirms that multi-architecture OCI
  indexes may carry annotations and that image configs may carry labels. The
  required fields are README URL, RFC3339 creation time, and description.
- YAML parsing, Prettier, Actionlint, ShellCheck, and diff validation pass for
  both container workflows.
- The published-container workflow now fails unless the multi-architecture
  index exposes the required Artifact Hub annotations and the pulled image
  exposes the corresponding config labels.
- Release run
  [`30545984732`](https://github.com/bekirdag/tnl-intelligence/actions/runs/30545984732)
  published `0.1.1` successfully from commit `0ca1be1`.
- Registry inspection confirms that `0.1.1` has the required index annotations,
  image config labels, both target architectures, and per-platform attestation
  manifests.
- The first verification run exposed a canary implementation issue:
  `docker manifest inspect` omitted index annotations that are present in the
  raw OCI index. The canary now reads the canonical raw index through
  `docker buildx imagetools inspect --raw`.
- Corrected verification run
  [`30546748528`](https://github.com/bekirdag/tnl-intelligence/actions/runs/30546748528)
  passed the metadata, architecture, runtime, health, and authentication gates.
- Grype `0.112.0` found one critical and six high vulnerabilities in `0.1.1`.
  Six were packages bundled only with the unused npm CLI in the runtime base
  image. The remaining finding was `fast-uri` `3.1.3`, fixed in `3.1.4`.
- The hardened local candidate removes npm/npx from the runtime image and locks
  `fast-uri` `3.1.4`. A clean Docker build, non-root read-only startup,
  `/healthz`, unauthenticated MCP rejection, and npm/npx absence all pass.
- A Grype scan of the hardened local candidate reports four medium findings and
  zero high or critical findings. The durable published-image canary now pins
  Grype by digest and fails on any high or critical vulnerability.

## Current Blocker

Artifact Hub account creation and repository registration are intentionally
blocked until the hardened `0.1.2` image passes the published-container canary.
