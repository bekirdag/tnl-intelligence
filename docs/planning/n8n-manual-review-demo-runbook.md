# n8n Manual Review Demo Runbook

Date: 2026-07-21
Status: Ready for account holder recording

## Purpose

Record the single uncut video required by the n8n Creator Portal after the TNL
node passed automated review. Keep the recording at five minutes or less and do
not expose the API key on screen.

## Prerequisites

- A clean n8n instance that can install public community packages.
- `n8n-nodes-tnl-intelligence@0.1.4` from npm.
- A verified TNL member account with a working API key.
- A prepared sample query that returns cited results quickly.
- A screen recorder such as Loom with microphone narration enabled if desired.

## Uncut Recording Sequence

1. Show the empty or clean n8n instance and open community-node installation.
2. Install the exact package `n8n-nodes-tnl-intelligence@0.1.4` from npm.
3. Create a workflow and add **TNL Intelligence**.
4. Create a **TNL Intelligence API** credential. Paste the key while the
   password field is masked, then run the credential test and show success.
5. Run the most common TNL action with a short sample query. Show the returned
   citations, `asOf` value, and TNL attribution without exposing credentials.
6. Add an n8n AI Agent, connect the TNL node as a tool, and demonstrate one
   successful tool invocation.
7. End on the successful execution output and stop the recording without cuts.

## Submission

1. Upload the recording directly in the n8n Creator Portal or paste its
   shareable Loom link.
2. Confirm the link is viewable without the recorder's login.
3. Select **Submit for review**.
4. Record the submission timestamp and subsequent review status in
   `ACCOUNTS.md` and `tnl-distribution-publication-audit-progress.md`.

## Acceptance Checklist

- [ ] Five minutes or less.
- [ ] No edits or cuts.
- [ ] Exact npm version `0.1.4` is visible.
- [ ] Credential test succeeds.
- [ ] A common TNL action succeeds with cited output.
- [ ] One AI-agent tool invocation succeeds.
- [ ] API key and other secrets remain masked.
- [ ] Video link works in a signed-out browser.
