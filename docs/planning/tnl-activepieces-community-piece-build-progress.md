# TNL Activepieces Community Piece Build Progress

Date: 2026-07-30  
Status: Ready to publish — implementation and local qualification complete; npm authentication required  
Plan: [TNL Activepieces Community Piece Build Plan](tnl-activepieces-community-piece-build-plan.md)

## Workstream Progress

| Workstream | Status | Evidence or next gate |
| --- | --- | --- |
| Current policy and route | Complete | Unsolicited upstream PRs are paused; public npm community pieces remain supported |
| Duplicate check | Complete | No TNL piece or open TNL contribution found |
| Current framework inspection | Complete | Activepieces `0.86.3`, framework `0.32.0`, pieces-common `0.12.5` |
| Plan and progress | Complete | This pair of documents |
| Piece implementation | Complete | Six-action scoped package under `integrations/activepieces/piece-tnl-intelligence/` |
| Deterministic tests | Complete | Eight API, MCP, metadata, boundary, and redaction checks pass |
| Package qualification | Complete | Build, format, pack inventory, and clean consumer install pass |
| npm publication | Blocked later | Stored npm login and recorded granular token currently return `E401` |
| Activepieces install canary | Pending | Install public package after registry publication |

## Verified Baseline

- Official public community instructions say users install a public npm piece
  by package name from **Settings → My Pieces → Install Piece**.
- The required unique package name is
  `@theneuralledger/piece-tnl-intelligence`.
- The current Activepieces repository requires TypeScript pieces, masked auth,
  action-level auth declarations, fixed dependencies in the piece package, and
  lint/build verification.
- The TNL connector contract already defines the normalized operation names,
  bounded inputs, structured story output, and research workflow mapping.
- Docdex DAG session `mcp-118` records the local contract discovery sequence.

## Validation Log

| Check | Result |
| --- | --- |
| Activepieces latest release | `0.86.3` |
| `@activepieces/pieces-framework` | `0.32.0` |
| `@activepieces/pieces-common` | `0.12.5` |
| TNL duplicate search | No result |
| `npm whoami` using stored npm config | `E401` |
| `npm whoami` using `.creds` granular token | `E401` |
| `npm run typecheck` | Passed |
| `npm test` | Eight tests passed |
| `npm run build` | Passed |
| Prettier `3.6.2` check | Passed |
| `npm run pack:check` | 30 runtime/documentation files; no prohibited files |
| `npm run connectors:check` | Passed; 13 connector assets verified |
| `git diff --check` for Dify/Activepieces scope | Passed |
| npm tarball | `theneuralledger-piece-tnl-intelligence-0.1.0.tgz`, 10,190 bytes |
| npm tarball SHA-1 | `3eb2fbd95223e051b2002957309e7fb4e7a1ef60` |
| npm tarball integrity | `sha512-oJ7QW05ptmgp+2m+aX3ic5gnwaQJW0VSgYDcFBPp6dN4eHG0jI4tlwC2ikIC6j42QvOXGxc5nFarvfCjTQcdMw==` |
| Clean consumer install | Passed; one public export, six actions, zero triggers |

## Dependency Audit

The current official Activepieces framework packages bring nine production
audit findings transitively: three low and six high. npm reports no compatible
fix for `@activepieces/pieces-common@0.12.5`; its suggested framework change is
a downgrade from the current `0.32.0` to `0.29.0`. The piece uses only the
framework's fixed-destination HTTP client and does not exercise the reported
formula, proxy, multipart, or AI-gateway paths. The inherited findings are
recorded rather than hidden or "fixed" by downgrading the current framework.

## Current Blocker

Public npm publication is the only remaining blocker. It requires a refreshed
login or granular publishing token for the `tnlintelligence` publisher account.
After publication, install the package in Activepieces and run a six-action
canary before marking the channel live.
