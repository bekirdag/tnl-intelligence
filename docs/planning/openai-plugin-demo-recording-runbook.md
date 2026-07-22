# OpenAI Plugin Demo Recording Runbook

Date: 2026-07-22
Status: Web recording hosted; iOS and Android segments remain required

## Recording goal

Produce a clean marketplace-review recording that visibly demonstrates the
authenticated TNL Intelligence developer-mode app, all six read-only research
tools on ChatGPT web, and a successful TNL research invocation on both iOS and
Android.

## Web recording order

1. Start from a new ChatGPT conversation with **TNL Intelligence OAuth
   Production Final** enabled.
2. Run each prompt separately and wait for its cited result before continuing.
3. Keep the TNL tool-call card and final answer visible for several seconds.

### Exact prompts

1. **What changed**
   `Use TNL Intelligence's tnl_research_what_changed tool to identify what changed in the semiconductor supply chain over the last seven days. Return one concise result with citations.`
2. **Compare sources**
   `Use TNL Intelligence's tnl_research_compare_sources tool to compare source agreement, omissions, contradictions, framing, and timing for recent reporting on AI chip export controls. Return one concise comparison with citations.`
3. **Validate event**
   `Use TNL Intelligence's tnl_research_validate_event tool to validate a recent reported development in AI chip export controls. Return the bounded verification state, confidence, and cited evidence.`
4. **Asset exposure**
   `Use TNL Intelligence's tnl_research_asset_exposure tool to map semiconductor-company exposure to AI chip export controls. Distinguish documented and inferred exposure paths, horizons, and counterfactors, with citations.`
5. **Operational risk**
   `Use TNL Intelligence's tnl_research_operational_risk tool to assess operational risk to semiconductor supply chains from AI chip export controls. Include bounded scenarios, leading indicators, assumptions, impact paths, and citations.`
6. **Weekly consequential**
   `Use TNL Intelligence's tnl_research_weekly_consequential tool to create a concise cited brief of the most consequential semiconductor and AI developments from the last seven days.`

## Mobile segments

- Sign in to the same ChatGPT account and enable the same TNL developer-mode app.
- On iOS, run prompt 1 and keep the successful tool card/result visible.
- On Android, run prompt 6 and keep the successful tool card/result visible.
- Do not expose passwords, API keys, OAuth codes, browser settings, or unrelated
  conversations in any recording.

## Acceptance checklist

- [x] Web begins from a clean new conversation.
- [x] The TNL app name is visible.
- [x] All six distinct TNL tools run successfully on web.
- [x] Results show citations or source URLs.
- [ ] iOS shows one successful authenticated TNL tool call.
- [ ] Android shows one successful authenticated TNL tool call.
- [ ] No secret or unrelated personal information appears.
- [ ] Final combined video is hosted at a reviewer-accessible URL without login.

## Hosted web segment

- Reviewer URL: `https://theneuralledger.com/demos/openai/tnl-intelligence-web-demo.mp4`
- The URL returns `200` with `Content-Type: video/mp4` and requires no login.
- This is a provisional web-only segment. Do not submit it as the final recording
  until the required iOS and Android demonstrations have been appended.
