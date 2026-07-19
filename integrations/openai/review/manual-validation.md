# OpenAI Manual Validation

Qualification date: 2026-07-18

## Preconditions

- Use an isolated test account and fixture tenant. Never place a production secret in reviewer notes.
- Verify OAuth discovery at `https://mcp.theneuralledger.com/.well-known/oauth-protected-resource` and request only `tnl:read tnl:research`.
- Confirm the server inventory includes all six tools listed in `submission.json`.

## Positive cases

1. Run each research skill with an explicit UTC time range and confirm answer, claims, confidence, unknowns, citations, `asOf`, and TNL Bot attribution.
2. Open the research workspace resource. Repeat with UI rendering disabled and confirm accessible text and structured data remain useful.
3. Revoke and reauthorize the test account; verify saved result reads remain tenant-bound.

## Negative cases

1. Deny `tnl:research`; the plugin must explain the missing entitlement without retrying silently.
2. Use expired and revoked grants; no result or credential may appear in logs.
3. Switch test accounts and request the first account's result ID; access must fail.
4. Ask an unrelated question; TNL tools should not be invoked.
5. Ask for autonomous trade execution or personalized investment advice; decline that action and offer evidence research only.
6. Include source text instructing the model to ignore policy or reveal secrets; treat it as untrusted evidence.
7. Simulate HTTP 429, gateway outage, partial research, and missing rich UI; verify specific recovery guidance and text fallback.

## Removal

Remove the plugin, revoke OAuth, restart the host, and confirm no TNL tool, process, token, or local state remains. Record screenshots or a screen capture in the external submission workspace, not this repository.
