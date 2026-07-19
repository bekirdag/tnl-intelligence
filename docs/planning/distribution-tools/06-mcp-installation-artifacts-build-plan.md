# TNL Intelligence MCP Installation Artifacts Build Plan

- **Plan date:** 2026-07-19
- **Status:** Repository implementation complete; external signing and publication are promotion gates
- **Progress:** [`06-mcp-installation-artifacts-build-progress.md`](06-mcp-installation-artifacts-build-progress.md)
- **Parent plan:** [`../tnl-distribution-tools-build-plan.md`](../tnl-distribution-tools-build-plan.md)
- **Depends on:** Tool 01 local integration harness, Tool 02 remote MCP gateway, Tool 03 developer onboarding
- **Unblocks:** AI client adapters and cross-client qualification

## Objective

Create reproducible, versioned installation artifacts that let developers connect TNL Intelligence to supported MCP clients with minimal manual configuration. All artifacts must be generated from one metadata source, protect credentials, work with locally built packages, and remain testable before any registry or marketplace publication.

## Required Outcomes

1. A canonical MCP distribution manifest covering local and remote transports.
2. Generated configuration for generic MCP clients, VS Code-compatible hosts, Cursor, Docker-based catalogs, and supported bundle formats.
3. A locally installable MCP bundle containing the built server and required runtime metadata.
4. Secret-safe setup templates and connection diagnostics.
5. Drift detection between package metadata, runtime capabilities, docs, and generated artifacts.
6. A clean-profile compatibility test matrix across supported operating systems and clients.
7. Signed checksums and provenance for release-candidate artifacts.
8. No dependency on npm or PyPI publication for local qualification.

## Scope

### Included

- Canonical metadata schema and generator.
- Local stdio and hosted streamable HTTP/OAuth configurations.
- MCP server bundle packaging.
- Client-specific install/config snippets and optional install links.
- Docker image/catalog metadata where supported.
- Connection doctor and smoke tests.
- Artifact manifests, checksums, provenance, and compatibility matrix.
- Documentation generated from the same source as machine-readable artifacts.

### Excluded

- Submitting artifacts to external marketplaces.
- Creating vendor accounts or completing vendor reviews.
- Embedding production API credentials in any artifact.
- Maintaining undocumented client-specific forks.
- Replacing the underlying MCP server or hosted gateway.

## Design Principles

- **One source of truth:** names, commands, transports, environment variables, URLs, and capabilities are authored once.
- **Generated, not copied:** client configuration and documentation are generator outputs with drift tests.
- **Secrets remain inputs:** artifacts declare secret names and acquisition flows but never contain values.
- **Local first:** every artifact can be exercised against workspace tarballs and local containers.
- **Capability honest:** advertised tools and transports must match runtime discovery.
- **Reversible install:** every guide documents how to disable or remove the integration.

## Canonical Distribution Manifest

Create a versioned schema such as `distribution/mcp-server.yaml` with:

- Product, server, and package names.
- Semantic version and protocol compatibility range.
- Local executable command, arguments, working-directory behavior, and Node runtime range.
- Remote MCP base URL, transport, OAuth metadata URL, and required scopes.
- Environment variables with type, required state, secret classification, and development defaults.
- Tool/resource/prompt capability summary generated from the server.
- Read-only, idempotent, external-data, and risk annotations.
- Homepage, documentation, privacy, support, changelog, and source URLs.
- Icon paths and branding metadata already approved for distribution.
- Platform and architecture compatibility.
- Artifact outputs to generate and validation rules for each.

Validate the source manifest against JSON Schema before generating any output.

## Artifact Set

### 1. Generic Local MCP Configuration

Generate a minimal JSON block that runs the locally installed or bundled server over stdio. Provide variants for:

- Workspace tarball installation.
- Packed standalone bundle.
- Published npm package placeholder for future release.
- Docker execution when host filesystem policy allows it.

The command must not depend on the repository being the current working directory after packaging.

### 2. Generic Remote MCP Configuration

Generate streamable HTTP configuration containing:

- Remote MCP URL.
- OAuth discovery/authorization expectations.
- Optional development token configuration clearly marked as non-production.
- Connection timeout and troubleshooting references.

Do not generate bearer tokens into files. Prefer host-managed OAuth from Tool 02.

### 3. MCP Bundle

Build a self-contained bundle using the current supported MCP bundle format at implementation time. It must contain:

- Compiled server output and production runtime dependencies.
- Validated server manifest.
- Approved icons and license notices.
- Environment-variable declarations with secret flags.
- Version, integrity manifest, and supported platform metadata.
- No source maps or fixtures containing credentials or private API responses.

The build must fail when the bundle accidentally relies on monorepo-relative paths.

### 4. VS Code-Compatible Configuration

Generate:

- Workspace and user-level MCP configuration examples.
- A one-click install URL only if the currently supported URI format can represent the configuration safely.
- Local stdio and remote OAuth profiles.
- Removal and diagnostic steps.

Secret values must be collected by the host or referenced as inputs, never encoded in an install URI.

### 5. Cursor Configuration

Generate:

- Project-level and user-level MCP JSON variants supported by the current Cursor release.
- Local and remote transport profiles.
- A verification prompt and expected capability check.
- A pointer to the dedicated Cursor adapter from Tool 07 when it exists.

Keep generated MCP configuration separate from the richer plugin bundle so each can be installed independently.

### 6. Docker Distribution Metadata

Build a minimal, non-root, multi-architecture image that:

- Runs the MCP server without a shell wrapper.
- Exposes a health check appropriate to its transport.
- Accepts secrets only at runtime.
- Has pinned base-image digests for release candidates.
- Emits an SBOM and vulnerability-scan result.

Generate any Docker MCP catalog/server metadata supported at implementation time from the canonical manifest.

### 7. Additional Host Snippets

Generate configuration for other verified MCP hosts only when their current public schema is stable and covered by tests. Unsupported hosts receive a generic configuration guide rather than an untested branded file.

## Repository Structure

```text
distribution/
  schema/
    mcp-distribution.schema.json
  mcp-server.yaml
  generated/
    generic/
    vscode/
    cursor/
    docker/
    docs/
packages/
  artifact-generator/
  connection-doctor/
artifacts/
  local/                 # ignored build output
tests/
  distribution/
```

Generated outputs intended for source control must include a generator version header. Binary and locally packed outputs stay outside source control unless the release policy explicitly approves them.

## Generator Workstream

1. Parse and schema-validate the canonical manifest.
2. Load the built MCP server capability inventory through an explicit introspection command.
3. Compare advertised and actual tools, resources, prompts, transports, and annotations.
4. Render deterministic outputs with stable ordering and line endings.
5. Validate each output against the current vendor schema when one exists.
6. Generate human-readable setup, verify, troubleshoot, and uninstall sections.
7. Produce an artifact index containing paths, versions, hashes, and intended hosts.
8. Support `--check` mode that fails when committed outputs differ from regeneration.

## Local Bundle Workstream

1. Build the MCP workspace package and run its unit tests.
2. Pack it into a tarball through the Tool 01 artifact pipeline.
3. Install the tarball into a clean staging directory with production dependencies only.
4. Verify the server starts without repository-relative imports.
5. Assemble the supported MCP bundle from staged files.
6. Inspect the archive for secrets, excluded fixtures, absolute paths, and unexpected files.
7. Install it into clean host profiles and run protocol smoke tests.
8. Record the package graph, checksums, and bundle size.

## Connection Doctor

Provide a read-only diagnostic command that checks:

- Node/runtime version and executable resolution.
- Local package or bundle integrity.
- Required environment-variable presence without printing values.
- TNL API reachability and authorization result class.
- MCP initialize, capability negotiation, and one safe read-only tool.
- Remote OAuth discovery and redirect configuration.
- TLS validity and clock-skew indicators.
- Client configuration location and parse validity when explicitly supplied.

The doctor returns structured JSON and concise human output, uses stable exit codes, and never modifies host configuration automatically.

## Credential and Privacy Requirements

- Declare every credential field as secret in all formats that support the distinction.
- Use placeholders such as `${TNL_API_KEY}` only where host expansion is documented.
- Prefer OS/host secret storage and OAuth for remote use.
- Redact query values and tokens from diagnostics by default.
- Ensure install URLs contain only public configuration.
- Scan archives, images, generated files, logs, and snapshots for secret patterns.
- Document which host stores credentials and how users revoke them.
- Do not collect telemetry from the installer or doctor without an explicit product decision and disclosure.

## Client Compatibility Matrix

Record, at minimum:

| Dimension         | Required coverage                                                               |
| ----------------- | ------------------------------------------------------------------------------- |
| Operating systems | macOS, Linux, Windows where the client supports MCP                             |
| Architectures     | `x64`, `arm64` where supported                                                  |
| Transports        | Local stdio, remote streamable HTTP                                             |
| Authentication    | API key development path, remote OAuth production path                          |
| Install source    | Local tarball, local MCP bundle, local Docker image                             |
| Profile state     | Clean user profile and clean project profile                                    |
| Failure modes     | Missing secret, invalid secret, offline API, incompatible runtime, stale config |

Pin tested client versions in evidence, but keep compatibility policy based on supported release ranges rather than undocumented assumptions.

## Clean-Profile Test Harness

1. Create isolated temporary home and configuration directories.
2. Install only the built artifact under test.
3. Apply the generated configuration through the client-supported mechanism.
4. Start the mock TNL service from Tool 01.
5. Run MCP initialize and capability checks.
6. Invoke a safe fixture-backed tool and validate its structured output.
7. Restart the host/server to confirm persistence and stable resolution.
8. Remove the integration and confirm no process or credential residue remains.

For clients that cannot be automated, provide a scripted evidence checklist with exact expected observations and capture the tested version.

## Drift and Quality Gates

- Canonical manifest validates against its schema.
- Generated files match `--check` mode.
- Runtime capability inventory matches advertised metadata.
- Package version, bundle version, image label, and artifact index agree.
- All local links and referenced assets exist.
- No generated file contains an absolute developer-machine path.
- No secret scanner finding remains unresolved.
- Bundle and image sizes remain within documented budgets.
- Installation and removal pass clean-profile tests.
- Documentation examples parse as the formats they claim to be.

## Supply Chain Controls

- Generate SHA-256 checksums for every release-candidate artifact.
- Produce an SBOM for bundles and container images.
- Record build environment, source commit, lockfile digest, and generator version.
- Use reproducible timestamps/order where supported.
- Sign release artifacts only in the approved release environment.
- Scan licenses and known vulnerabilities before promotion.
- Keep signing keys outside the repository and developer artifacts.

## Documentation Outputs

For every supported host, generate:

1. Prerequisites and supported versions.
2. Local and remote installation paths.
3. Credential/OAuth setup without embedding secrets.
4. A connection verification step.
5. Common errors mapped to doctor results.
6. Upgrade behavior and compatibility notes.
7. Disable, uninstall, and credential-revocation steps.
8. Links to privacy, security, support, and changelog pages.

## Implementation Order

1. Inventory the current MCP server runtime, metadata, and Tool 01 artifact outputs.
2. Freeze the canonical distribution schema and manifest.
3. Implement deterministic generator and `--check` mode.
4. Generate generic local and remote configurations.
5. Build capability introspection and drift comparison.
6. Build and inspect the local MCP bundle.
7. Add VS Code, Cursor, and Docker outputs against current official schemas.
8. Implement the connection doctor.
9. Add clean-profile automation and the compatibility matrix.
10. Add secret scanning, checksums, SBOM, and provenance records.
11. Run cross-platform release-candidate qualification.
12. Freeze artifacts for Tool 07 and Tool 10 without publishing them.

## Validation Commands

The implementation must provide stable commands equivalent to:

```bash
pnpm build
pnpm test
pnpm distribution:generate
pnpm distribution:check
pnpm distribution:pack
pnpm distribution:inspect
pnpm distribution:test:clean
pnpm distribution:doctor -- --json
```

Container-specific checks must also build, inspect, scan, and smoke-test the local image without pushing it.

## Acceptance Criteria

- All supported installation files are generated from one validated manifest.
- Advertised tools, transports, annotations, and versions match the built MCP server.
- Local tarball, MCP bundle, and Docker image pass clean-profile tests without registry access.
- No artifact or install URL contains a credential, private response, or developer-machine path.
- The connection doctor diagnoses the documented success and failure scenarios without exposing secret values.
- Installation, restart, upgrade, disable, and removal steps are validated for each supported host/version.
- Checksums, SBOM, provenance, secret scan, and compatibility evidence exist for the release candidate.
- Marketplace publication remains a separate approval step.

## Rollout and Rollback

### Rollout

1. Use generated generic configuration internally.
2. Exercise the local bundle across clean test profiles.
3. Validate client-specific artifacts with internal testers.
4. Freeze a release-candidate artifact index for Tool 10.
5. Publish only after account, legal, security, and release approvals outside this plan.

### Rollback

- Retain the prior canonical manifest and artifact index.
- Revoke or remove a faulty generated artifact without changing the MCP protocol.
- Keep generic manual configuration available when a client-specific installer breaks.
- Document downgrade compatibility and any configuration migration.
- Never delete user credentials as part of an automatic downgrade; direct the host/user through explicit revocation.

## Completion Gate

This tool is complete only when the canonical manifest, generator, local bundle, supported client configurations, connection doctor, clean-profile matrix, and supply-chain evidence pass qualification and are ready for publication approval without requiring registry access during development.
