# TNL Intelligence GitHub and GHCR Release Plan

Date: 2026-07-19
Status: Complete
Release: `v0.1.0`
Repository: https://github.com/bekirdag/tnl-intelligence

## Objective

Publish the repository-complete TNL Intelligence tool suite through the release
channels that are authenticated and under repository control:

- source on the public GitHub `main` branch;
- a signed Git tag and public GitHub Release for `v0.1.0`;
- qualified release artifacts attached to that GitHub Release; and
- `ghcr.io/bekirdag/tnl-intelligence:0.1.0` plus `latest` in GHCR.

npm, PyPI, the MCP Registry, hosted gateway deployment, and third-party
marketplace submission remain separate owner-configuration gates.

## Preconditions

1. GitHub CLI authentication resolves to `bekirdag` with repository admin access.
2. Local and remote `main` start from the same base commit.
3. The pending tree contains only the reviewed Tools 01-10 implementation and
   release documentation.
4. Package and artifact versions resolve to `0.1.0`.
5. No `v0.1.0` tag or GitHub Release already exists.
6. The owner has explicitly authorized commit, push, GitHub Release, and GHCR
   publication.

## Execution Order

### Phase 1: Release preparation

- Review tracked and untracked changes and run whitespace/secret checks.
- Record the release in `CHANGELOG.md` and `docs/release/v0.1.0.md`.
- Confirm the GHCR workflow uses `GITHUB_TOKEN`, package-write permission, and
  immutable version plus convenience `latest` tags.
- Document rollback before promotion.

### Phase 2: Local qualification

- Run repository validation through `docdexd run-tests` where supported.
- Run aggregate `npm run qualify:release` to rebuild, freeze, and qualify the
  complete release candidate.
- Stage the intended tree and run `docdexd hook pre-commit`.
- Do not proceed when a technical gate, source-integrity check, or secret scan
  fails.

### Phase 3: Source publication

- Commit the reviewed tree to `main`.
- Push `main` and confirm local and remote commit IDs match.
- Rebuild and requalify the candidate from the clean commit so its source record
  no longer reports a dirty worktree.
- Create annotated tag `v0.1.0` at the qualified commit and push it.

### Phase 4: GitHub Release

- Create the public `v0.1.0` GitHub Release from the annotated tag.
- Use `docs/release/v0.1.0.md` as release notes.
- Attach the MCPB, Python wheel/source distribution, AI adapter archives,
  automation connector packages, SBOM, provenance, checksums, qualification
  evidence, and release-candidate manifest.
- Verify the release is non-draft, non-prerelease, and points to the expected
  commit.

### Phase 5: GHCR publication

- Dispatch `.github/workflows/release-container.yml` with version `0.1.0`.
- Wait for the workflow to complete successfully.
- Verify the GHCR package exposes both `0.1.0` and `latest` for the expected
  image digest and make the package public when repository permissions allow.
- Pull the versioned image, start it locally with a non-secret test key, and
  verify `/healthz` plus unauthenticated rejection behavior.

### Phase 6: Evidence closeout

- Record commit, tag, release URL, workflow run, image tags/digest, smoke-test
  result, and remaining owner gates in the separate progress document.
- Commit and push the documentation-only closeout after publication.
- Compare final state against the owner directive and this plan.

## Validation Gates

| Gate                  | Required result                                         |
| --------------------- | ------------------------------------------------------- |
| Tree review           | No unrelated or secret-bearing files staged             |
| Repository validation | All configured checks pass                              |
| Release qualification | Seven technical gates pass for one clean candidate      |
| Pre-commit            | Docdex semantic gate passes on staged changes           |
| Remote source         | `origin/main` equals the qualified commit               |
| Tag                   | `v0.1.0` resolves to the qualified commit               |
| GitHub Release        | Published, public, correct tag, expected assets present |
| GHCR workflow         | Completed successfully from the qualified source        |
| Image identity        | `0.1.0` and `latest` resolve to the published digest    |
| Runtime smoke         | Health passes and unauthenticated access is rejected    |

## Rollback

- Source history is never rewritten. A bad release is corrected with a new
  commit and patch version.
- Mark a faulty GitHub Release as a prerelease or delete the release entry while
  preserving the Git tag for auditability; publish a corrected patch release.
- Remove the `latest` image tag from a faulty image and repoint it only through a
  validated replacement workflow run. Keep the immutable `0.1.0` digest for
  incident evidence unless it contains sensitive material.
- Because this release does not deploy the hosted gateway or mutate TNL
  production, rollback does not require production database, DNS, or traffic
  changes.

## Exit Criteria

The plan is complete when GitHub source, the `v0.1.0` Release, and the versioned
GHCR image are public and verified, the progress trail contains reproducible
evidence, and all unsupported publication channels remain explicitly gated.
