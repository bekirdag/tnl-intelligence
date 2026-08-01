# TNL Anthropic MCPB Submission Progress

Date: 2026-08-01
Plan: [TNL Anthropic MCPB Submission Plan](tnl-anthropic-mcpb-submission-plan.md)
Status: In progress — corrected bundle qualified; live tool exercise and submission remain

| Workstream                            | Status      | Evidence / next gate                                                                                                                                                          |
| ------------------------------------- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current Anthropic documentation audit | Complete    | Anthropic accepts MCPB desktop extensions through a separate form that does not require the paid Team/Enterprise remote-connector portal.                                     |
| Existing artifact audit               | Complete    | `.artifacts/tool-06/tnl-intelligence-0.1.0.mcpb` is reproducible and self-contained, uses manifest v0.4, includes integrity/SBOM/notices/icon, and declares eight tools.      |
| Privacy-package audit                 | Complete    | The bundle now contains a root `README.md` with an explicit Privacy Policy section covering request data, host credential storage, retention, sharing, removal, and support.  |
| Tool-metadata audit                   | Complete    | All eight manifest tools now retain their runtime titles and read-only/non-destructive annotations.                                                                          |
| Implementation and regression tests   | Complete    | Generator `1.1.0`, canonical artifact declaration, deterministic packer, unit tests, and pack-time fail-closed validation were updated.                                       |
| Automated clean-profile qualification | Complete    | `npm run test:distribution:no-container` passed after reproducible packing, integrity/secret checks, and clean-profile doctor checks.                                         |
| Live all-tool qualification            | Blocked     | Exercise all eight tools with a fresh bounded reviewer account/key; no production secret or previously exposed key may be reused.                                             |
| Reviewer credentials                  | Blocked     | Requires a fresh bounded test account/key; no production secret or previously exposed key may be reused.                                                                      |
| Anthropic form                        | Draft ready | Required contact, description, GitHub, primary-party, and bundle fields are populated. Owner must review/accept the directory terms and authorize final submission.            |

## Current evidence

- Public repository: `https://github.com/bekirdag/tnl-intelligence`.
- Public privacy policy: `https://theneuralledger.com/privacy`.
- Public support: `https://github.com/bekirdag/tnl-intelligence/issues`.
- Existing release asset: `https://github.com/bekirdag/tnl-intelligence/releases/download/v0.1.0/tnl-intelligence-0.1.0.mcpb`.
- Current bundle path: `.artifacts/tool-06/tnl-intelligence-0.1.0.mcpb`.
- Corrected candidate SHA-256: `86173e3494e2a063dcbb9e87bd899b03716bb747ea4e90f97fb63f261fb05610` (4,032,856 bytes).
- `npm test --workspace @theneuralledger/artifacts`: 4/4 tests passed.
- `npm run distribution:check`: 15 generated artifacts matched the canonical generator output.
- `npm run test:distribution:no-container`: passed reproducible MCPB packing and clean-profile doctor checks.
- Archive inspection confirmed root `README.md`, `manifest.json`, `integrity.json`, SBOM, third-party notices, license, icon, and bundled runtime.
- The MCPB author URL now points to `https://github.com/bekirdag`, satisfying the submission form's GitHub-profile requirement.
- The Anthropic form draft is saved under the signed-in Google account with `tnladmin@theneuralledger.com` as primary contact and the corrected MCPB attached; it has not been submitted.
- Anthropic requires every tool to include a title and applicable read/write annotations, working test credentials, public documentation, and local-connector privacy disclosures.
- The remote connector submission portal requires a paid Team or Enterprise organization and is intentionally excluded by the zero-cost rule.

## Next action

Commit and push the corrected public bundle source, then obtain the owner's directory-terms acceptance and final-submit authorization. A fresh bounded reviewer credential remains a separate review-readiness gate if Anthropic requests testing access.
