# TNL Zapier Re-review and Fedia/Mbin Setup Plan

Date: 2026-08-08

## Goal

Close every finding in Zapier's publication review for app `244155`, return the corrected
integration for re-review, then establish a new user-authorized Fedia/Mbin publishing
destination without exposing credentials or purchasing service access.

## Workstream 1: Zapier reviewer fixes

1. Use `https://developers.theneuralledger.com/` as the public, human-readable API
   documentation URL.
2. Align the integration title and description with the core brand, **The Neural Ledger**.
3. Render the API key as a password field.
4. Reduce the connection label to the non-sensitive account name returned by `/v1/me`.
5. Rename the weekly trigger to `New TNL Weekly Consequential Edition`.
6. Rename the generating weekly action to `Create TNL Weekly Edition`.
7. Make every action/search description begin with a third-person verb.
8. Add regression coverage, run tests/build/validation, and inspect the generated metadata.
9. Upload the corrected draft, update the Zapier publication fields, and request re-review.

## Workstream 2: Fedia/Mbin account and OAuth

1. Select a healthy, free Mbin-compatible instance.
2. Verify or create the dedicated TNL account and secure recovery details without printing
   them.
3. Verify a writable TNL magazine and a manual controlled posting path.
4. Obtain engineering's exact OAuth callback URL from repository configuration.
5. Register a private client, request only `entry:create` plus the minimum identity scope,
   and complete the user authorization-code flow.
6. Store secrets only in the protected credentials file and record non-secret identifiers.
7. Run a controlled canary only after the account, destination, scopes, and token all pass.

## Validation and safety

- Preserve unrelated working-tree changes.
- Never print or commit API keys, OAuth secrets, authorization codes, or tokens.
- Do not purchase a plan or enable a paid trial.
- Do not publish a public Fedia/Mbin canary without a verified dedicated TNL destination.
- Record all completed checks and human gates in the separate progress document.
