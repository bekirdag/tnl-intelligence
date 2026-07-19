# Release Qualification

Tool 10 qualifies the locally built TNL Intelligence portfolio as one release
candidate. It does not publish packages, upload marketplace bundles, enable a
production feature, create an account, or approve business rollout.

## Commands

```bash
npm run artifacts:release-candidate
npm run qualify:contracts
npm run qualify:e2e
npm run qualify:security
npm run qualify:privacy
npm run qualify:reliability
npm run qualify:performance
npm run qualify:accessibility
npm run qualify:docs
npm run qualify:release
```

The aggregate command rebuilds and tests the exact local tarballs, wheel,
source distribution, MCP bundle, connector archives, adapter archives, and
container evidence. It then freezes their hashes, runs the technical gates,
signs the manifest for local integrity, and leaves publication at
`no-go-pending-owner`.

## Evidence

Machine-readable evidence is written to `.artifacts/tool-10/`:

- `release-candidate.json`: source, package, contract, fixture, and artifact
  inventory.
- `compatibility-matrix.json`: copied matrix used by the candidate.
- `scenario-evidence.json`: six cross-tool executable scenarios.
- `security-evidence.json`, `privacy-evidence.json`,
  `reliability-evidence.json`, and `performance-evidence.json`: lane records.
- `rollback-evidence.json`: migration, disable, fallback, and recovery rehearsal.
- `sbom.spdx.json`, `provenance.json`, `license-report.json`, and
  `scan-summary.json`: supply-chain records.
- `evidence-index.json`: hashes for every final qualification record.
- `technical-signature.json`: Ed25519 manifest integrity evidence. An ephemeral
  local key is not an owner signature and cannot authorize publication.

## Decision Rule

The technical decision is `go` only when all seven automated gates pass for the
same candidate ID. The eighth business gate always remains pending until the
owner explicitly approves the exact manifest digest through the separate
publication process.
