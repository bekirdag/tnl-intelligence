# TNL Artifact Hub Container Publication Plan

Date: 2026-07-30
Status: In progress
Progress: [TNL Artifact Hub Container Publication Progress](tnl-artifact-hub-container-publication-progress.md)

## Objective

Qualify the public multi-architecture TNL container for Artifact Hub, publish a
metadata-complete immutable image release, register the tagless GHCR repository,
and obtain verified-publisher status without exposing registry credentials.

## Source Artifact

- Repository: `https://github.com/bekirdag/tnl-intelligence`
- OCI repository: `ghcr.io/bekirdag/tnl-intelligence`
- Artifact Hub URL: `oci://ghcr.io/bekirdag/tnl-intelligence`
- Existing release tag: `0.1.0`
- Existing digest:
  `sha256:c40569e9ad52f936055c50a4e3de57e4a807db3d61c3e5a42480e73c409998cc`

## Readiness Findings

The existing image is public and has `linux/amd64`, `linux/arm64`, and
provenance attestations. It runs as `node`, declares a health check, and was
previously smoke-tested. It does not carry the metadata Artifact Hub requires:
the index has no package annotations and the platform configs have no OCI
labels. Therefore registration must wait for a new metadata-complete tag.

## Workstreams

### 1. Release Metadata

- Add `docker/metadata-action@v6` to the container release workflow.
- Generate the semantic-version and `latest` tags from one metadata source.
- Add OCI title, description, documentation, source, URL, vendor, version,
  revision, and license fields.
- Add Artifact Hub README, category, logo, and support metadata.
- Attach annotations at both manifest and index levels so the multi-architecture
  index is self-describing.
- Generate explicit maximum-mode provenance and an SBOM attestation.

### 2. Immutable Container Release

- Validate the workflow syntax and changed-file scope.
- Commit and push the metadata workflow.
- Publish a new immutable semantic-version tag rather than mutating `0.1.0`.
- Run the existing published-container verification workflow.
- Verify the public digest, both architectures, annotations/labels, SBOM,
  provenance, non-root user, health endpoint, and unauthenticated MCP rejection.

### 3. Artifact Hub Registration

- Search Artifact Hub for an existing `ghcr.io/bekirdag/tnl-intelligence`
  repository before adding one.
- Create or sign in to the TNL-owned Artifact Hub account and organization.
- Add a **Container images** repository using the tagless OCI URL.
- Mark the semantic-version tag immutable and `latest` mutable.
- Record the repository ID from Artifact Hub.

### 4. Verified Publisher Metadata

- Create `artifacthub-repo.yml` only after Artifact Hub assigns the repository
  ID.
- Include the exact repository ID and the owner email matching the Artifact Hub
  account.
- Push the file as an OCI artifact at the reserved `artifacthub.io` tag with the
  documented media types.
- Use only a short-lived package-write credential through stdin or GitHub
  Actions; never commit or print it.

### 5. Publication Verification

- Wait for indexing and inspect the public package while signed out.
- Verify the README, release tag, install command, source/docs/support links,
  supported architectures, license, security report, SBOM/provenance evidence,
  and verified-publisher badge.
- Mark the channel **Published** only after a digest-pinned pull and container
  canary pass from a clean environment.

## Rollback

- Do not mutate or delete `0.1.0`.
- If the new image fails, leave the immutable tag as failed evidence, restore
  `latest` to the prior digest through the controlled release workflow, and
  issue a new patch version for corrections.
- Artifact Hub repository registration can be removed without changing the
  underlying GHCR images.
