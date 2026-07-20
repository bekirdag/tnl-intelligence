# TNL Intelligence npm Publication Plan

**Plan date:** 2026-07-20

**Status:** Complete

**Progress:** [tnl-npm-publication-progress.md](./tnl-npm-publication-progress.md)

**Release:** `0.1.0`

**Scope:** `@theneuralledger`

## Objective

Publish the four public npm packages required by the TNL Intelligence SDK, MCP,
and CLI distribution; replace the one-time bootstrap authentication with
per-package GitHub OIDC trusted publishing; and verify that clean consumers can
install and run the released artifacts.

## Authorization And Boundaries

- The npm user `bekirdag` is authenticated and is owner of the
  `theneuralledger` npm organization.
- Publishing a package name/version is irreversible. Qualification must use the
  tagged `v0.1.0` source in an isolated worktree before the first publish.
- Publish only `@theneuralledger/sdk`, `@theneuralledger/research`,
  `@theneuralledger/mcp`, and `@theneuralledger/cli` at `0.1.0`.
- The first version needs an interactive owner-authenticated bootstrap because
  npm trusted publishers and staged publishing require an existing package.
- All later versions must use the protected GitHub Actions OIDC workflow. Do not
  create or store a long-lived npm automation token.

## Dependency Order

1. `@theneuralledger/sdk`
2. `@theneuralledger/research`
3. `@theneuralledger/mcp`, which depends on the SDK and Research packages
4. `@theneuralledger/cli`, which depends on the SDK and MCP packages
5. Per-package trusted publisher configuration
6. Clean-consumer verification

## Workstreams

### 1. Preflight

1. Confirm `npm whoami` is `bekirdag`.
2. Confirm `npm org ls theneuralledger --json` lists `bekirdag` as owner.
3. Confirm all four package versions are absent from the public registry.
4. Confirm `v0.1.0` exists and create an isolated detached worktree at that tag.
5. Confirm package names, versions, public access, repository URL, license,
   runtime files, and dependency versions from the tagged source.

### 2. Qualification

1. Install the tagged lockfile with `npm ci`.
2. Build SDK, Research, MCP, and CLI in dependency order.
3. Run their package test suites and the repository package-content gate.
4. Generate dry-run package manifests and inspect included files, sizes,
   dependency metadata, executable mappings, README, and license.
5. Record hashes of the exact tarballs used for bootstrap publication.

### 3. Bootstrap Publication

1. Publish the SDK as a public scoped package with provenance disabled only for
   this local bootstrap.
2. Verify registry metadata and install the SDK into a clean temporary consumer.
3. Repeat for Research, MCP, then CLI.
4. Stop immediately on a name/version conflict, auth failure, unexpected package
   content, or dependency resolution failure.

### 4. Permanent Trusted Publishing

1. Create or confirm the protected GitHub environment `npm`.
2. For each package, authorize GitHub Actions repository
   `bekirdag/tnl-intelligence`, workflow `release-npm.yml`, environment `npm`,
   and the `npm publish` action.
3. Confirm `.github/workflows/release-npm.yml` runs on a GitHub-hosted runner with
   `id-token: write` and publishes SDK, Research, MCP, then CLI.
4. Set package publishing access to require 2FA and disallow traditional tokens
   after the OIDC relationship is configured.
5. Do not rerun the `0.1.0` workflow because the version is already immutable.
   Validate the trusted-publisher configuration on the next patch release.

### 5. Public Verification

1. Verify public npm pages, versions, dist-tags, maintainers, repository, license,
   and dependency metadata for all four packages.
2. Install all packages from the registry in a clean directory with no workspace
   links or local tarballs.
3. Import the SDK, inspect MCP discovery, and run `tnl --help`.
4. Record registry URLs, integrity values, install/runtime evidence, and any
   remaining owner-controlled security settings in the progress document.

## Rollback

- Never reuse or overwrite a published name/version.
- If a package is defective, deprecate the affected version and publish a tested
  patch. Do not unpublish unless npm policy and an active security incident
  require it.
- If trusted publishing is misconfigured, remove or correct the trust
  relationship before the next release; do not replace it with a persistent
  write token.

## Completion Criteria

- All four `0.1.0` packages are public and installable from npm.
- Clean runtime checks pass without local workspace resolution.
- Each package has the intended GitHub OIDC trusted publisher.
- The protected `npm` GitHub environment exists.
- Publication evidence and remaining security gates are recorded separately from
  the plan.
