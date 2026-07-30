# TNL Activepieces Community Piece Build Plan

Date: 2026-07-30  
Status: In progress  
Progress: [TNL Activepieces Community Piece Build Progress](tnl-activepieces-community-piece-build-progress.md)

## Objective

Build, qualify, package, and publish a public Activepieces community piece for
**TNL Intelligence**. The piece must expose the six normalized TNL operations,
use fixed production destinations, protect the TNL API key, preserve structured
evidence, and be installable by package name from Activepieces.

## Current Distribution Route

Activepieces currently auto-closes unsolicited pull requests from contributors
who are not organization members or collaborators. Its supported independent
community route is:

1. Build a public piece package.
2. Give it a unique organization-scoped npm name.
3. Publish it to the public npm registry.
4. Install it in Activepieces from **Settings → My Pieces → Install Piece**.

Target package: `@theneuralledger/piece-tnl-intelligence`  
Initial version: `0.1.0`

## Required Action Surface

1. `search_intelligence`
2. `get_intelligence`
3. `list_recent_changes`
4. `get_exposure`
5. `run_research`
6. `get_weekly_edition`

The first four actions use `https://theneuralledger.com`. Research actions use
`https://mcp.theneuralledger.com/mcp`. No arbitrary destination URL is exposed.

## Workstreams

### 1. Package Scaffold

- Add `integrations/activepieces/piece-tnl-intelligence/`.
- Use the current public `@activepieces/pieces-framework` and
  `@activepieces/pieces-common` releases.
- Add strict TypeScript configuration, npm package metadata, README, license,
  and a public designated TNL logo URL.
- Require a masked TNL API key and validate it against the fixed TNL account
  endpoint.

### 2. Fixed-Destination Client

- Bound identifiers, search strings, timestamps, cursors, and page sizes.
- Apply explicit request timeouts.
- Send credentials only in the authorization header.
- Normalize authentication, authorization, rate-limit, validation, timeout,
  malformed-response, and upstream errors without exposing response bodies,
  headers, or credentials.
- Support JSON and SSE MCP responses and clean up MCP sessions best-effort.

### 3. Six Activepieces Actions

- Use stable action names aligned with the connector catalog.
- Add `audience: "both"` and read-only, idempotent AI metadata.
- Return structured objects with story IDs, revisions, timestamps, canonical
  URLs, citations, claims, confidence, verification status, and research
  evidence unchanged.
- Enumerate the six allowed research workflows and their MCP tool mappings.

### 4. Automated Qualification

- Add deterministic tests using a mock request transport.
- Test auth validation, query encoding, boundaries, API error normalization,
  MCP initialization/tool calls, JSON/SSE parsing, session cleanup, and secret
  redaction.
- Run TypeScript build, lint-compatible formatting, package inventory checks,
  npm package dry-run, and existing TNL connector validation.

### 5. Public npm Publication

- Confirm npm authentication without printing or persisting the token.
- Publish `@theneuralledger/piece-tnl-intelligence@0.1.0` with public access.
- Verify registry metadata, tarball digest, clean installation, package import,
  and six-action inventory.
- Record the public package URL and installation command.

## Promotion Gates

- No secret, local credential, `.env`, cache, log, VCS metadata, or test fixture
  is present in the npm tarball.
- The package builds from a clean dependency installation.
- All deterministic tests pass.
- `npm pack --dry-run` contains only runtime and documentation files.
- Status becomes **Published** only after public registry verification and clean
  consumer installation.

## Current External Gate

The npm login stored on the workstation and the granular token recorded in
`.creds` both return `E401`. Implementation and qualification can proceed
without interruption. A fresh npm authentication will be required only at the
final publish step.

## Rollback

- All TNL source changes are isolated under `integrations/activepieces/` and the
  paired planning/progress files.
- An npm release is immutable; any correction uses a version increment rather
  than unpublishing a consumed package.
- Existing dirty worktree changes outside this integration remain untouched.
