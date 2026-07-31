# TNL Activepieces Publication Plan

Date: 2026-07-31
Status: In progress
Progress: [TNL Activepieces Publication Progress](tnl-activepieces-publication-progress.md)

## Objective

Publish the qualified TNL Intelligence community piece through Activepieces'
official upstream contribution path and prove all six public actions in a real
Activepieces runtime without exposing credentials.

## Boundaries

- Use `integrations/activepieces/piece-tnl-intelligence` as the qualified source.
- Preserve the six stable action names and fixed production API boundary.
- Never commit, print, or publish a TNL API key or other credential.
- Keep npm releases on GitHub Actions/OIDC trusted publishing; do not create an
  npm publishing token.
- Treat package publication, upstream acceptance, and live runtime validation as
  separate gates.

## Workstreams

### 1. Upstream Requirement Reconciliation

1. Inspect the current Activepieces contribution guide, repository structure,
   package conventions, validation commands, and ownership requirements.
2. Compare the qualified standalone package to a current community piece.
3. Record any adaptation required for the upstream monorepo without changing
   the canonical action behavior.

### 2. Upstream Contribution

1. Create or update the `bekirdag/activepieces` fork.
2. Create a focused `codex/tnl-intelligence-piece` branch from upstream main.
3. Add the TNL piece in the exact current upstream location and format.
4. Run the repository's focused formatting, linting, testing, build, and
   affected-project checks.
5. Inspect the diff for secrets, generated artifacts, unrelated changes, and
   unstable identifiers.
6. Push the branch and open an upstream pull request with API ownership,
   authentication, privacy, testing, support, and compatibility evidence.

### 3. Live Runtime Canary

1. Start a clean Activepieces runtime or use an authenticated TNL-owned hosted
   workspace when local validation cannot exercise custom pieces.
2. Install or load the published piece.
3. Store the API credential only in the runtime's secret store.
4. Execute every public action with bounded inputs and verify structured output,
   citations, and failure handling.
5. Remove test flows/connections when practical and record only non-secret
   evidence.

### 4. Publication Handoff

1. Record the upstream pull request and validation evidence in the progress
   trail and distribution ledger.
2. After merge, verify official Activepieces discovery and repeat the clean
   six-action canary.
3. Record reviewer feedback or external blockers without claiming acceptance
   before it occurs.

## Exit Criteria

- The public npm package remains installable and OIDC-managed.
- A focused upstream Activepieces pull request is open with required checks
  passing, or an exact maintainer-owned blocker is recorded.
- All six actions pass in a real Activepieces runtime.
- No credential or private evidence is committed or transmitted outside the
  authorized runtime.
- The distribution audit and account ledger reflect independently verified
  status.
