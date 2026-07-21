# n8n Manual Review Demo Plan

Date: 2026-07-21

## Objective

Produce one uncut screen recording of five minutes or less that demonstrates the exact public package under review, `n8n-nodes-tnl-intelligence@0.1.4`, and satisfies every Creator Portal manual-review requirement.

## Recording Sequence

1. Show the Creator Portal entry at version `0.1.4` with automated review complete and manual review awaiting video.
2. Open the prepared local n8n instance and install `n8n-nodes-tnl-intelligence@0.1.4` from npm through **Settings → Community nodes**.
3. Create a new workflow with a Manual Trigger and TNL Intelligence node.
4. Create a new TNL Intelligence API credential, keep the API key masked, and show the successful credential test.
5. Execute the common **Search Intelligence** action and show returned live data.
6. Execute a second representative action if time remains.
7. Add TNL Intelligence as an AI Agent tool and execute one example tool call.
8. Return to the Creator Portal, upload the uncut recording, and submit it for manual review.

## Rehearsed Runbook

Target duration: 2:30-3:30, hard stop before 5:00.

1. **0:00-0:10 — Portal proof:** show `n8n-nodes-tnl-intelligence`, Automated Review **Complete**, Manual Review **Awaiting Video**, and the five review requirements.
2. **0:10-0:30 — Fresh npm install:** switch to the staged n8n Community Nodes screen, install exact package `n8n-nodes-tnl-intelligence@0.1.4`, accept the community-code notice, and show `v0.1.4`, TNL Intelligence, and TNL Trigger.
3. **0:30-1:25 — New workflow and credential:** open a new workflow, add Manual Trigger, add TNL Intelligence → Search Intelligence, create a new masked TNL credential, set query `artificial intelligence`, page size `5`, and execute.
4. **1:25-1:45 — Live action proof:** leave the successful output visible long enough to show the operation, count, titles, summaries, URLs, timestamps, entities, confidence, and impact fields.
5. **1:45-2:40 — AI Agent tool proof:** navigate directly to prepared native workflow `w3miXVbiLXMndbsF`. Reinstallation restores its preconfigured TNL tool beside Chat Trigger, AI Agent, and OpenAI Chat Model. Submit: `Use the TNL Intelligence tool to search for artificial intelligence news. Summarize the first result and include its title.`
6. **2:40-3:05 — Result proof:** show the successful TNL tool execution and the grounded AI title, summary, source URL, publication date, status, and confidence.
7. **3:05-3:15 — End frame:** return to the Creator Portal and stop recording. Upload happens after recording stops so upload latency cannot push the video past five minutes.

## Exact Navigation

- Start: `https://creators.n8n.io/nodes/n8n-nodes-tnl-intelligence/integration`
- Installer: `http://127.0.0.1:5678/settings/community-nodes`
- New workflow: `http://127.0.0.1:5678/workflow/new?projectId=9M7qjYbya98GG0ST`
- Prepared AI workflow: `http://127.0.0.1:5678/workflow/w3miXVbiLXMndbsF`

The AI workflow deliberately retains an unknown-node placeholder while the package is uninstalled. Installing `0.1.4` restores that TNL tool node with its validated credential and parameters, avoiding unnecessary AI workflow construction during the uncut take.

## Preflight Gates

- Local n8n instance runs on `http://127.0.0.1:5678`.
- Public package `0.1.4` installs successfully and exposes TNL Intelligence plus TNL Trigger.
- A verified TNL member API key passes the node credential test.
- A common TNL action returns live output.
- An AI Agent can call one TNL action as a tool.
- The clean recording-state reset is rehearsed and timed below five minutes.

## Safety

- Never reveal API keys or passwords in the recording.
- Keep unrelated browser tabs and account pages out of the selected recording region.
- Do not edit the final video; n8n explicitly requires no cuts.
