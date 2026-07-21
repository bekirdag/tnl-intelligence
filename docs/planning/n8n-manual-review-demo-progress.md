# n8n Manual Review Demo Progress

Date: 2026-07-21
Status: Complete; submitted for n8n manual review
Plan: [n8n Manual Review Demo Plan](n8n-manual-review-demo-plan.md)

## Progress

| Gate | Status | Evidence or blocker |
| --- | --- | --- |
| Creator Portal status | Pass | `n8n-nodes-tnl-intelligence` version `0.1.4`; automated review complete; manual review awaiting video |
| Clean local n8n runtime | Pass | n8n `2.30.2` running locally on `127.0.0.1:5678` with a dedicated demo data directory |
| Public package installation | Pass | UI installation of `n8n-nodes-tnl-intelligence@0.1.4` completed; n8n reports TNL Intelligence and TNL Trigger |
| Node discovery | Pass | TNL Intelligence is installed and exposes seven actions; `usableAsTool` is visible through the app-node workflow path |
| Live TNL credential | Pass | A newly issued live key was saved only in the local n8n credential store; the credential was accepted without exposing the key in documentation |
| Common action execution | Pass | **Search Intelligence** returned 25 live results for `artificial intelligence`, including titles, summaries, URLs, timestamps, entities, confidence, and impact metadata |
| AI Agent tool execution | Pass | An n8n AI Agent using `gpt-5-mini` invoked **TNL Intelligence Tool**; the tool completed in 776 ms and the agent returned a grounded title, summary, source URL, publication date, and status |
| Clean recording reset | Pass | Test output was cleared and the community package was uninstalled after preflight. n8n is staged on the Community Nodes install screen so the recording can demonstrate a fresh `0.1.4` installation, new workflow, new masked credential, common action, and AI Agent tool call without cuts |
| Optimized uncut rehearsal | Pass | Exact package reinstall restored the prepared AI workflow automatically; the rehearsed AI Agent call completed successfully in 8.264 seconds and returned a grounded TNL title, summary, source URL, status, and confidence |
| Final uncut recording | Pass | The recorded take installed exact package `0.1.4`, created a new masked credential, returned five live Search Intelligence results, and showed a successful AI Agent tool call with grounded TNL output |
| Creator Portal submission | Pass | The video was uploaded and submitted for manual review on 2026-07-21; submission completion was confirmed by the operator |

## Validation Notes

- The public npm release is the artifact under review. The monorepo development copy still reports version `0.1.0`, so it must not be used in the recording.
- n8n `2.30.2` requires Node.js `>=22.22`; the system Node.js `22.18.0` is too old. The preflight runtime uses the bundled Node.js `24.14.0`.
- Automatic package installation completed in the UI and the node detail panel lists Intelligence and Research actions.
- The standard node and the AI-tool node both use the public npm release `0.1.4` and the same masked TNL credential.
- A temporary OpenAI project key named `n8n Creator Portal demo` was created for the local AI Agent validation; the secret is not stored in this repository or in these notes.
- The preflight workflows served only as validation fixtures. Uninstalling the package removed their community-node instances as expected; the recording will create a fresh review workflow after reinstalling `0.1.4`.
- Final recording state is clean: package uninstalled, Community Nodes installer open, AI chat and execution cleared, and the native AI workflow retained as a deterministic template.
- Publication is now gated only by n8n's external manual-review decision and any resulting reviewer feedback.
