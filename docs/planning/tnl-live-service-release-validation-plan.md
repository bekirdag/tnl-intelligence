# TNL Live Service and Release Validation Plan

Date: 2026-07-20
Status: In progress
Progress: [TNL Live Service and Release Validation Progress](tnl-live-service-release-validation-progress.md)

## Objective

Validate the production TNL API with a dedicated test account and newly created
bounded API key, exercise every published SDK/package and qualified integration,
repair confirmed defects, and publish only newly qualified immutable versions
that are required by actual fixes.

## Boundaries

- Never write the test password, API key, recovery code, token, or OAuth secret
  to the repository, planning records, logs, command arguments, or package
  artifacts.
- Use the supplied `test2` account only for bounded read-only validation.
- Preserve unrelated working-tree changes, including the existing `.gitignore`
  modification.
- Do not republish or overwrite immutable npm or PyPI `0.1.0` artifacts.
- Do not bump or publish a package unless a confirmed defect requires a source
  change and the exact release candidate passes qualification.
- Do not add billing, paid plans, production credentials, or marketplace
  submissions that are not necessary for validation.

## Workstreams

### 1. Public Baseline and Repository Truth

1. Record current Git state without modifying unrelated work.
2. Inspect package versions, release workflows, and public npm/PyPI/GitHub/GHCR
   metadata.
3. Map package and integration dependencies before any source change.

### 2. Live Account and API Validation

1. Sign in to `theneuralledger.com` with the supplied test account.
2. Create a bounded test API key and keep it only in the active validation
   session.
3. Exercise account, news, search, entity, asset, feed, and saved-search
   contracts with non-destructive requests.
4. Revoke the key after validation if the UI supports bounded cleanup.

### 3. Package and Tool Qualification

1. Install public npm and PyPI artifacts into clean temporary environments.
2. Run JavaScript, Python, CLI, MCP, container, and public OpenAPI smoke tests.
3. Run focused repository qualification for SDKs, adapters, connectors,
   distribution assets, release tarballs, and security/privacy contracts.

### 4. Account-Backed Integration Validation

1. Validate Postman public workspace, collection, environment, and tests.
2. Validate qualified OpenAI, Cursor, n8n, Pipedream, and Zapier artifacts and
   their portal/account state without submitting gated marketplace releases.
3. Confirm registry/directory listings and generated installation assets remain
   accurate.

### 5. Repair, Release, and Verification

1. Diagnose each confirmed defect with AST and impact-graph evidence before
   editing source.
2. Apply the smallest compatible fix and add regression coverage.
3. Run the complete relevant qualification lane and package-tarball inspection.
4. Version only affected public packages, publish through the protected trusted
   workflows, and verify the new immutable registry artifacts.
5. Record exact evidence, remaining platform gates, and rollback information.

## Exit Criteria

- The live API passes bounded authenticated and unauthenticated contract checks.
- Every public package installs from a clean environment and passes its smoke
  test.
- Every qualified adapter/connector passes repository validation.
- Confirmed defects are fixed with regression evidence.
- Any necessary new package versions are published through the supported release
  paths and verified publicly; otherwise the existing versions remain unchanged.
- No secret appears in source, logs, documentation, or published artifacts.
