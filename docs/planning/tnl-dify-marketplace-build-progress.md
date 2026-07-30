# TNL Dify Marketplace Build Progress

Date: 2026-07-30  
Status: Under review — upstream PR open  
Plan: [TNL Dify Marketplace Build Plan](tnl-dify-marketplace-build-plan.md)

## Workstream Progress

| Workstream | Status | Evidence or next gate |
| --- | --- | --- |
| Upstream requirements | Complete | Current submission requirements and PR template read from `langgenius/dify-plugins:main` |
| Duplicate check | Complete | GitHub code search returned no TNL/Dify plugin match |
| Reference package inspection | Complete | Inspected accepted Apify tool plugin `1.0.3` and current package layout |
| Dify CLI | Complete | Official `dify` CLI `0.6.7` downloaded and used from an isolated temporary directory |
| TNL plugin scaffold | Complete | Runtime plugin and repository-local validation/test harness added under `integrations/dify/` |
| Six tools | Complete | Six normalized, fixed-destination, read-only tools implemented |
| Deterministic tests | Complete | 12 mocked client/metadata tests pass |
| Official packaging | Complete | Two clean builds produced the same package digest |
| Community/Cloud validation | Pending | Run if an authenticated workspace is available; otherwise disclose limitation |
| Marketplace PR | Complete | [`langgenius/dify-plugins#2802`](https://github.com/langgenius/dify-plugins/pull/2802) is open and awaiting review |

## Verified Baseline

- Upstream repository:
  `https://github.com/langgenius/dify-plugins`
- Current runner release:
  `dify-plugin-daemon` `0.6.7`
- Current submission rules require a valid manifest, README, privacy policy,
  minimal dependencies, runtime-only package contents, and explicit risk
  classification.
- Current PR template requires Community Edition and Cloud testing or a
  documented limitation.
- No `The Neural Ledger` or `tnl_intelligence` entry was found upstream.
- Existing TNL connector behavior is concentrated in
  `integrations/zapier/lib/common.js`; Docdex found inbound consumers but no
  outbound dependency from that module.
- The Dify implementation will be additive and will not modify the dirty Zapier
  files.
- The package contains 25 runtime files. It excludes tests, scripts, caches,
  environment files, VCS metadata, logs, and bytecode.
- The designated TNL logo is embedded unchanged; its SHA-256 matches the source
  asset at `integrations/cursor/tnl-intelligence/assets/tnl-int-logo.png`.

## Planning Evidence

- Docdex AST inspection completed for
  `integrations/zapier/lib/common.js`.
- Docdex impact graph found the Zapier actions, searches, triggers, and tests as
  inbound consumers. Therefore the Dify plugin will reproduce the normalized
  contract without refactoring that shared file.
- Docdex impact diagnostics returned no unresolved imports for the reference
  file.
- DAG session `mcp-113` confirms the retrieval/decision sequence used to choose
  an additive implementation.

## Validation Log

| Command or check | Result |
| --- | --- |
| Isolated `dify version` | `v0.6.7` |
| Python SDK import check | Provider and all six tool classes imported successfully with `dify-plugin 0.9.1` |
| GitHub duplicate searches | No matches |
| Upstream submission requirements | Read and incorporated |
| Accepted package archive inspection | Apify `1.0.3` structure inspected |
| `python -m unittest discover -s integrations/dify/test -v` | 12 tests passed |
| `python integrations/dify/scripts/validate.py` | Passed |
| `npm run connectors:check` | Passed; 13 connector assets verified |
| `git diff --check -- integrations/dify docs/planning/tnl-dify-*` | Passed |
| Official CLI package, build A | SHA-256 `e88b2f607d01e61cd42a8ac710899f3c6b4105411878a257173822e01b1fab35` |
| Official CLI package, build B | Same SHA-256; deterministic |
| Package inventory audit | 25 runtime files; zero prohibited files |
| Upstream package commit | `7ea1aec15ac5380a31550b5700137e0fae8ce849` |
| Marketplace PR | `https://github.com/langgenius/dify-plugins/pull/2802` |

## Current Gates

- Upstream reviewer approval and automated Marketplace checks.
- Live Dify Community Edition and Dify Cloud installation was unavailable in
  the submission environment and is disclosed explicitly in the PR. It must be
  completed before the integration is described as published and live.
