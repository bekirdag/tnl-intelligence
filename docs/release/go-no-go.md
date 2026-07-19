# Go/No-Go Record

This document describes the decision contract. The machine-readable decision is
generated in `.artifacts/tool-10/evidence-index.json` for the exact candidate ID.

| Gate              | Automated requirement                                                         | Decision owner                             |
| ----------------- | ----------------------------------------------------------------------------- | ------------------------------------------ |
| Contract          | Schemas and compatibility matrix validate                                     | Release qualification                      |
| Functional        | Six artifact-based scenarios pass                                             | Release qualification                      |
| Security/privacy  | No blocker; secret, tenant, retention, dependency, and provenance checks pass | Release qualification plus security review |
| Reliability       | Load, recovery, reconciliation, and rollback thresholds pass                  | Reliability maintainer                     |
| Operations        | Owners, alerts, response targets, and runbooks are present                    | Platform maintainer                        |
| Artifact          | Hashes, versions, SBOM, provenance, scans, and licenses agree                 | Release qualification                      |
| Documentation     | Guides, links, capabilities, accessibility, and lifecycle instructions pass   | Developer experience maintainer            |
| Business approval | Owner approves the exact manifest digest for publication/rollout              | Repository owner                           |

Automated completion may set the technical decision to `go`. Publication remains
`no-go-pending-owner` until a separate owner action records approval for the
exact manifest SHA-256. Regenerating any source or artifact invalidates that
approval target and requires a new candidate.
