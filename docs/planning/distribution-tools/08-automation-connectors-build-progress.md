# Tool 08: Automation Connectors Build Progress

Date: 2026-07-19
Status: Repository implementation complete; host registration and publication pending owner action
Plan: [Automation Connectors Build Plan](08-automation-connectors-build-plan.md)
Master progress: [TNL Distribution Tools Build Progress](../tnl-distribution-tools-build-progress.md)

## Workstream Progress

| Workstream                    | Status   | Evidence or next gate                                                                                                |
| ----------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------- |
| Current platform requirements | Complete | Node 22; n8n CLI 0.39.3/runtime 2.30.2; Zapier core/CLI 19; current Pipedream component contracts                    |
| Shared connector core         | Complete | Seven operations, normalized errors, research run/result retrieval, signed triggers, polling, and lifecycle          |
| n8n connector                 | Complete | All seven operations plus webhook/polling triggers, strict cloud lint, clean build, behavior, and lifecycle fixtures |
| Pipedream connector           | Complete | App, seven actions, two sources, result retrieval, raw-body verification, dedupe, deploy/deactivate fixtures         |
| Zapier connector              | Complete | Six creates, one search, two triggers, custom auth, REST Hook lifecycle, weekly polling, and isolated validation     |
| Parity and lifecycle          | Complete | Generator inspects actual host sources; behavior tests execute every common operation and trigger/lifecycle contract |
| Review candidates             | Complete | Clean-install tarballs, Zapier upload zip, archive scans, and machine-readable qualification evidence generated      |

## Current Decisions

1. All three hosts remain thin translations over one typed connector core.
2. Tool 04 signed webhooks are the default trigger; polling exists only as an explicit fallback.
3. Credentials remain platform-managed and never appear in action output, logs, fixtures, or archives.
4. Public registries, platform accounts, deployments, and marketplace submissions remain owner-controlled promotion steps.

## Current Blockers

None for repository implementation. Creator verification, hosted callback
canaries, app registration, upload, and marketplace review require
owner-controlled external accounts and were not performed.

## Next Gate

Register the n8n, Pipedream, and Zapier projects in owner-controlled accounts,
deploy hosted callbacks, run live OAuth/webhook/result-retrieval canaries, and
submit only the exact qualified candidates.

## Qualification Evidence

- Runtime: Node `v22.18.0`, npm `10.9.3`.
- Aggregate command: `npm run test:connectors`.
- Machine evidence: `.artifacts/tool-08/qualification-evidence.json`.
- Candidate hashes are recorded in that generated evidence and the Tool 10
  release candidate; this progress file does not duplicate stale digests.
- Operations: [Automation connectors](../../automation-connectors.md).
