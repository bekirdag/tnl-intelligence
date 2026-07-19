# Tool 03: Developer Onboarding and Sample Access Build Progress

Date: 2026-07-19
Status: Repository implementation complete; public hosted deployment pending owner action
Plan: [Developer Onboarding and Sample Access Build Plan](03-developer-onboarding-sample-access-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                             | Status   | Evidence or next gate                                                                                |
| -------------------------------------- | -------- | ---------------------------------------------------------------------------------------------------- |
| Developer credential service           | Complete | One-time scrypt-verified keys, scopes, expiry, rotation, revocation, issuance limits, and audit pass |
| Sample tier and no-key dataset         | Complete | Versioned CC0 synthetic dataset, static-only routing, pagination, filters, and enforced limits pass  |
| Canonical OpenAPI and explorer         | Complete | Canonical contract and sample-first, non-persistent developer console are hosted locally             |
| Quick starts and local artifacts       | Complete | Curl, TypeScript, Python, CLI, and MCP execute from clean local tarball/wheel consumers              |
| Postman assets                         | Complete | Collection and safe environment regenerate deterministically and execute against the sample service  |
| Usage, limits, and support UX          | Complete | Tenant-bounded usage, whitelisted checkpoints, actionable errors, and account deletion are tested    |
| Documentation information architecture | Complete | Start, concepts, quick starts, errors, credential operations, security, and support pages are linked |
| Security and onboarding qualification  | Complete | Isolation, no persistence/leakage, browser/accessibility, contract drift, and regression gates pass  |

## Current Implementation Decisions

1. Tool 03 will be a separate onboarding workspace that can run entirely against local identity and sample fixtures.
2. Credential secrets are returned only from create/rotate operations; persistent records contain a salted verifier and a non-secret prefix only.
3. The no-key sample lane is a separate static dataset and cannot proxy or fall through to production.
4. Explorer state defaults to the sample API and keeps any live key in memory only.
5. Generated examples install local tarballs/wheels during qualification; public registries are not prerequisites.

## Validation Evidence

| Check                                  | Result | Evidence                                                                                          |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------- |
| Tools 01-02 prerequisites              | Pass   | Clean artifact harness and hosted gateway qualification passed                                    |
| Repository truth and detailed plan     | Pass   | Credential, sample, explorer, quick-start, Postman, usage, and support requirements reviewed      |
| Impact and DAG analysis                | Pass   | Server/OpenAPI/generator impact graphs and diagnostics reviewed; DAG traces exported              |
| Credential and isolation tests         | Pass   | 9 onboarding tests cover secrets, lifecycle, tenants, sessions, limits, usage, and deletion       |
| Sample/OpenAPI/Postman drift tests     | Pass   | Static lane, canonical OpenAPI, deterministic asset generation, and collection execution pass     |
| Onboarding browser/accessibility tests | Pass   | Desktop/mobile real-browser flows pass with no overflow, persistent storage, or console errors    |
| Clean local consumer qualification     | Pass   | `.artifacts/tool-03/evidence.json` records curl, npm tarball, MCP, CLI, and Python wheel success  |
| Repository and packaging regressions   | Pass   | Workspace validate, Tool 01 harness, pack check, audit, Docdex tests, and `git diff --check` pass |

## Current Blockers

None. Production identity, durable stores, billing, and public hosting remain injected adapter/deployment concerns and do not block the completed local artifact.

## Next Gate

Deploy the public identity, durable stores, billing integration, and sample
service, then run the bounded onboarding canary without persisting client keys.
