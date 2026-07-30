# TNL Dify Marketplace Build Plan

Date: 2026-07-30  
Status: In progress  
Progress: [TNL Dify Marketplace Build Progress](tnl-dify-marketplace-build-progress.md)

## Objective

Build, qualify, package, and submit a read-only **The Neural Ledger** tool plugin
to Dify Marketplace. The plugin must expose the six normalized TNL connector
operations, protect the API credential, preserve structured evidence and source
links, and satisfy the current `langgenius/dify-plugins` submission contract.

## Source Contracts

- Canonical public API: `https://theneuralledger.com/v1/openapi.json`
- Canonical MCP endpoint: `https://mcp.theneuralledger.com/mcp`
- Existing operation behavior:
  `integrations/zapier/lib/common.js`,
  `integrations/pipedream/`, and `@theneuralledger/connectors`
- Marketplace requirements:
  `langgenius/dify-plugins/docs/plugin-submission-requirements.md`
- Target author and organization directory: `bekirdag`
- Initial plugin version: `0.1.0`

## Required Tool Surface

1. `search_intelligence`
2. `get_intelligence`
3. `list_recent_changes`
4. `get_exposure`
5. `run_research`
6. `get_weekly_edition`

The first four tools use the fixed TNL HTTPS API. Research tools use the fixed
production MCP endpoint and map only to the six allowed read-only research
workflows. The plugin must not accept arbitrary destination URLs.

## Workstreams

### 1. Repository and Upstream Baseline

- Preserve all pre-existing dirty TNL worktree changes.
- Confirm no TNL plugin or open submission already exists upstream.
- Inspect one current accepted Dify tool plugin and the latest runner release.
- Record Dify Community Edition/Cloud validation limitations truthfully.

### 2. Plugin Scaffold and Metadata

- Add `integrations/dify/tnl_intelligence/`.
- Create `manifest.yaml`, `main.py`, provider YAML/Python, tool YAML/Python,
  runtime helpers, `_assets/`, `README.md`, `PRIVACY.md`, and
  `requirements.txt`.
- Use `bekirdag` as author and include TNL website, support, privacy, terms, and
  source links.
- Declare a masked required `TNL API Key` provider credential.
- Set bounded memory, Python 3.12 runner metadata, and the current minimum Dify
  version supported by the validated runner.

### 3. Fixed-Destination TNL Client

- Implement bounded HTTPS requests with explicit timeouts.
- Send the API key only in the authorization header.
- Normalize authentication, validation, rate-limit, timeout, upstream, and
  malformed-response failures without echoing credentials or response headers.
- Bound strings, page sizes, time windows, and pagination inputs.
- Preserve stable IDs, revisions, timestamps, canonical/source URLs, citations,
  claims, verification state, confidence, and research status in structured
  output.

### 4. Six Dify Tools

- Implement one YAML schema and one Python tool class per operation.
- Keep stable operation names aligned with the existing connector contract.
- Return Dify variable messages with structured JSON results.
- Ensure research workflow selection is enumerated, not free-form.
- Clean up MCP sessions best-effort without masking successful results.

### 5. Privacy, Security, and Package Hygiene

- Document exactly which credentials, queries, identifiers, time windows, and
  research questions are sent to TNL.
- State that the plugin itself has no persistence while linking to TNL privacy,
  retention/deletion, support, and terms information.
- Classify the submission conservatively under Dify's current risk rules.
- Exclude `.env`, caches, VCS metadata, logs, local paths, credentials, binaries,
  and development-only files from the `.difypkg`.

### 6. Automated Qualification

- Add deterministic unit tests using mocked HTTPS/MCP responses.
- Cover valid/missing/revoked credentials, pagination boundaries, no results,
  malformed input, timeouts, rate limits, source/citation preservation, MCP
  initialization/tool call/session cleanup, and redacted failures.
- Validate YAML, Python syntax/imports, manifest references, asset existence,
  privacy/README content, and package inventory.
- Run existing connector and repository checks required by the changed surface.

### 7. Dify CLI Package and Runtime Validation

- Use the current official Dify plugin CLI release.
- Run package validation and create
  `tnl_intelligence-0.1.0.difypkg`.
- Inspect the archive and record its digest.
- Install into Dify Community Edition and Dify Cloud when available; otherwise
  state the exact unavailable live-validation gate in the PR and do not claim it
  passed.
- Exercise all six tools with the bounded TNL reviewer account when a workspace
  is available.

### 8. Marketplace Contribution

- Fork `langgenius/dify-plugins` to `bekirdag`.
- Create a `codex/tnl-intelligence-0.1.0` branch.
- Add exactly one `.difypkg` under `bekirdag/tnl-intelligence/`, as required by
  the current contribution guide. The package itself contains the reviewed
  runtime source.
- Complete the current PR template with risk, privacy, package inventory,
  validation, source ownership, support, and any live-validation limitation.
- Push and open the upstream pull request.
- Record checks, reviewer feedback, merge, and Marketplace publication
  separately; never describe an open PR as published.

## Validation Commands

The final exact commands are recorded in the progress document. Expected gates
include:

```bash
python3 -m unittest discover -s integrations/dify/test
python3 integrations/dify/scripts/validate.py
dify plugin package ./integrations/dify/tnl_intelligence
unzip -l tnl_intelligence-0.1.0.difypkg
npm run connectors:check
docdexd hook pre-commit --repo /Users/bekirdag/Documents/apps/tnl-intelligence
```

## Promotion Gates

- No secret or private URL is present in source, tests, logs, or package.
- Six tool schemas and implementations are internally consistent.
- Local deterministic tests and official CLI packaging pass.
- The package archive contains only runtime-required files.
- A public upstream PR exists before status becomes **Under review**.
- Marketplace status becomes **Published** only after merge, public listing,
  clean installation, and live tool verification.

## Rollback

- TNL repository changes remain isolated under `integrations/dify/`, its tests,
  root validation wiring, and planning/progress files.
- Upstream work uses a separate fork branch and can be closed without affecting
  existing TNL packages or services.
- Do not delete or rewrite unrelated dirty worktree changes.
