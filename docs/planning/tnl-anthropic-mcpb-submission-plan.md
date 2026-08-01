# TNL Anthropic MCPB Submission Plan

Date: 2026-08-01
Owner: The Neural Ledger
Scope: Qualify and submit the existing TNL Intelligence desktop extension through Anthropic's separate MCPB submission form without purchasing a Claude Team or Enterprise plan.

## Constraints

- Use only the zero-cost desktop-extension path. Do not create or upgrade to a paid Claude organization.
- Never reuse production secrets or expose reviewer credentials in source, logs, chat, screenshots, or form evidence.
- Keep the public remote MCP connector and Microsoft connector paths out of scope; they have separate paid or business/legal gates.
- Preserve the user's unrelated dirty worktree changes and stage only files created or modified for this submission.

## Work plan

1. Audit Anthropic's current MCPB submission guide, directory policy, terms, asset requirements, review checklist, and submission form.
2. Inspect the released `tnl-intelligence-0.1.0.mcpb`, its generator, manifest schema, integrity evidence, bundled runtime, public documentation, and privacy material.
3. Update the generated MCPB so every tool retains its human-readable `title` and applicable `readOnlyHint`, `destructiveHint`, `idempotentHint`, and `openWorldHint` annotations.
4. Add a root bundle `README.md` containing installation, configuration, usage, support, data-handling, retention, third-party sharing, and a clearly headed Privacy Policy section.
5. Add regression tests that reject an MCPB manifest without titles/read-only annotations or a bundle without the required privacy README.
6. Rebuild the bundle reproducibly, verify its manifest, integrity file, SBOM, notices, archive layout, and secret-free contents, then run the existing clean-profile install/restart/tool/removal qualification.
7. Exercise every bundled tool with a fresh, bounded reviewer account and key. Store credentials only in the approved secret location and revoke them after review; do not put values in repository evidence.
8. Prepare the submission metadata, public URLs, icon, public release asset, test-account instructions, and policy acknowledgements.
9. Complete the Anthropic MCPB submission form. Pause only for a human-only identity login, legal attestation, or secret entry that the browser cannot safely perform.
10. Record the submission confirmation, review reference, remaining reviewer gate, and rollback/revocation instructions in the separate progress trail and `ACCOUNTS.md`.

## Acceptance criteria

- The current MCPB schema and Anthropic review requirements pass without waivers.
- All eight bundle tools expose titles and correct read-only annotations and succeed with valid bounded credentials.
- Missing, invalid, and revoked credentials fail safely without leaking values.
- The archive includes public privacy/support/documentation material and contains no embedded credential.
- The final artifact is reproducible and its published checksum matches the submitted asset.
- Anthropic accepts the form and returns a durable confirmation, or the progress trail records the exact external blocker without using a paid plan.

## Rollback

- Do not delete or overwrite the existing `v0.1.0` release asset.
- If qualification fails, withdraw the candidate from submission, revoke reviewer credentials, and retain the prior public release while a corrected version is prepared.
- If Anthropic rejects the listing, address feedback in source-controlled changes and resubmit; never weaken authentication, privacy, or tool annotations to bypass review.
