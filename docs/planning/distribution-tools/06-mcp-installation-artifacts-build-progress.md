# Tool 06: MCP Installation Artifacts Build Progress

Date: 2026-07-19
Status: Repository implementation complete; owner signing and publication pending
Plan: [MCP Installation Artifacts Build Plan](06-mcp-installation-artifacts-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                               | Status   | Evidence or next gate                                                                        |
| ---------------------------------------- | -------- | -------------------------------------------------------------------------------------------- |
| Canonical distribution contract          | Complete | `distribution/mcp-server.json` validates against the strict canonical schema                 |
| Deterministic generator and drift checks | Complete | 14 generated artifacts match runtime introspection, package versions, and annotations        |
| Local MCP bundle                         | Complete | Reproducible self-contained MCPB is assembled from local tarballs and inspected              |
| Client configuration artifacts           | Complete | Generic, VS Code, Cursor, Docker, and compatibility outputs contain placeholders only        |
| Connection doctor                        | Complete | Read-only local/remote diagnostics cover success and stable failure exit classes             |
| Supply-chain evidence                    | Complete | SHA-256 integrity, CycloneDX SBOM, notices, provenance, archive, and image audit recorded    |
| Clean-profile compatibility              | Complete | Bundle restart, safe tool call, removal, container health, and multi-architecture build pass |
| Qualification and regressions            | Complete | Distribution gate, 71 TypeScript tests, 10 Python tests, pack/audit, and Docdex gates pass   |

## Current Implementation Decisions

1. Local npm tarballs are the build input; no generated artifact may require a public registry.
2. Canonical metadata and committed generated files contain public URLs and credential placeholders only.
3. Generated host files are installation configuration, while richer Tool 07 adapters remain separate products.
4. Connection diagnostics are read-only and redact environment values, authorization material, and queries.
5. Marketplace publication, artifact signing with owner keys, and external registry promotion remain approval-controlled steps.

## Validation Evidence

| Check                                  | Result | Evidence                                                                                                |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------- |
| Tools 01-05 prerequisites              | Pass   | Local artifacts, gateway, onboarding, webhooks, and research exit gates pass                            |
| Repository and detailed plan review    | Pass   | Manifest, generators, bundle, clients, doctor, compatibility, and supply-chain requirements reviewed    |
| Impact, symbols, AST, and DAG analysis | Pass   | MCP definitions, imports, and prior search trace reviewed before edits; final diagnostics are empty     |
| Distribution contract and drift tests  | Pass   | `npm run distribution:check`; strict schema and 14 generated artifacts match eight runtime tools        |
| Clean-profile and bundle tests         | Pass   | `npm run test:distribution:no-container`; reproducible MCPB, restart, safe call, and cleanup pass       |
| Doctor success/failure tests           | Pass   | Local/API/MCP success and missing credential, bad config, integrity, and remote OAuth classes pass      |
| Container qualification                | Pass   | Non-root/read-only image, health, linux/amd64 and linux/arm64 builds, SBOM, and zero high findings pass |
| Workspace regression                   | Pass   | `npm run validate`; 71 TypeScript tests and strict builds pass                                          |
| Python regression                      | Pass   | Ruff, formatting, strict mypy, and 10 pytest cases pass in the managed environment                      |
| Package and dependency gates           | Pass   | Five publishable packages inspected; `npm audit --audit-level=high` reports zero vulnerabilities        |
| Docdex final gate                      | Pass   | 257 documents indexed and unresolved import diagnostics are empty                                       |

## Current Blockers

None for repository implementation. External marketplace submission and release signing remain owner-controlled promotion gates.

## Next Gate

Review the exact candidate, sign it with owner-controlled release keys, and
publish only the approved artifacts through the separate promotion workflow.
