# TNL Distribution Publication Audit Plan

Date: 2026-07-20
Status: In progress — marketplace submissions remain
Progress: [TNL Distribution Publication Audit Progress](tnl-distribution-publication-audit-progress.md)

## Objective

Reconcile the distribution strategy with the artifacts that are publicly
available, complete low-risk publication work supported by credentials already
present on this machine, and identify the exact owner or platform gate for every
remaining channel.

## Boundaries

- Use the vendor accounts and marketplace terms the owner has already created or
  accepted. Do not add billing details or grant unrelated third-party access.
- Do not submit an artifact that is absent from the repository or has not passed
  its documented qualification gate.
- Do not republish immutable npm or PyPI versions.
- Preserve the company-domain MCP namespace instead of replacing it with a
  personal GitHub namespace merely to avoid DNS verification.
- Treat third-party review as pending until a public listing or pull request can
  be verified.

## Workstreams

### 1. Registry and Release Reconciliation

1. Verify every public npm and PyPI project from the registry APIs.
2. Verify the GitHub Release, its installation artifacts, and the GHCR package.
3. Record canonical project and version URLs, not search URLs.
4. Distinguish public registry packages from release-only candidate artifacts.

### 2. Autonomous Publication Boundary

1. Inspect authenticated CLIs without exposing credentials.
2. Classify each channel as executable now, blocked by account/terms, blocked by
   owner-controlled DNS or secrets, blocked by a missing artifact, or awaiting
   third-party review.
3. Execute only repository-owned discovery updates and already-qualified package
   publications that use an existing authenticated registry owner.
4. Verify every completed external action from a signed-out/public endpoint.

### 3. Distribution Guide Update

1. Add a dated live-publication snapshot with package names, versions, and URLs.
2. Update stale account-state and launch-order language.
3. Add an explicit autonomous-action matrix so owner work is unambiguous.
4. Retain the detailed account and publication runbooks for future channels.

### 4. Validation and Promotion

1. Run focused package qualification before any new package publication.
2. Check Markdown formatting and links represented in the edited guide.
3. Run the Docdex pre-commit gate.
4. Commit and push only the scoped documentation and publication-control changes.

## Exit Criteria

- Every live package has its exact public name, version, and canonical URL in the
  distribution guide.
- Every immediately executable channel has either been completed and verified or
  has a concrete failed-authentication record.
- Every remaining channel names its exact owner, account, DNS, legal, artifact,
  or review gate.
- Every planned marketplace is recorded as built, account-ready, submitted,
  under review, published, or blocked by one exact external prerequisite.
- The plan is not complete while a planned submission is merely locally
  qualified or while its account exists without an integration/listing.
