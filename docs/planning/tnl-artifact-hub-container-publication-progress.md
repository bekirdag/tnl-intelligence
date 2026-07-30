# TNL Artifact Hub Container Publication Progress

Date: 2026-07-30
Status: In progress — `0.1.2` qualified; account email verification pending
Plan: [TNL Artifact Hub Container Publication Plan](tnl-artifact-hub-container-publication-plan.md)

## Workstream Progress

| Workstream                      | Status             | Evidence or next gate                                                                                                                 |
| ------------------------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------- |
| Public image inspection         | Complete           | `0.1.0` index and both platform configs inspected                                                                                     |
| Architecture gate               | Complete           | `linux/amd64` and `linux/arm64` present                                                                                               |
| Provenance baseline             | Complete           | Per-platform attestation manifests present                                                                                            |
| Artifact Hub metadata gate      | Failed on `0.1.0`  | Required README/created/description annotations or labels are absent                                                                  |
| Release workflow update         | Complete           | OCI/Artifact Hub labels and index annotations, SBOM, and explicit provenance added; all static checks pass                            |
| New immutable image             | Complete           | `0.1.2` published and independently verified at digest `sha256:bcd63ce34d50f694fb9ae6add066dcccd0054b5a24f7dd36e55463a17af1efe3` |
| Artifact Hub account/repository | Verification pending | Account `theneuralledger` created with `tnladmin@theneuralledger.com`; email verification link sent |
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
- Release run
  [`30547595411`](https://github.com/bekirdag/tnl-intelligence/actions/runs/30547595411)
  published `0.1.2` from commit `6d10e66`.
- Published-container run
  [`30548042520`](https://github.com/bekirdag/tnl-intelligence/actions/runs/30548042520)
  passed architecture, metadata, high/critical vulnerability, non-root,
  read-only runtime, health, and authentication gates.
- Public OCI index digest:
  `sha256:bcd63ce34d50f694fb9ae6add066dcccd0054b5a24f7dd36e55463a17af1efe3`.
- No existing TNL package or matching GHCR repository was found in Artifact Hub.
- Artifact Hub accepted the `theneuralledger` signup using
  `tnladmin@theneuralledger.com` and sent the required verification link.

## Current Blocker

Repository registration is blocked only by the account verification link sent
to `tnladmin@theneuralledger.com`, which routes to `info@wodo.io`. That routed
mailbox is not available through the connected Gmail or Outlook sessions.
