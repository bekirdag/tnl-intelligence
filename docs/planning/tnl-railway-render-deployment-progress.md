# TNL Railway and Render Deployment Progress

Date: 2026-08-01
Plan: [TNL Railway and Render Deployment Plan](tnl-railway-render-deployment-plan.md)
Status: In progress — local implementation and qualification underway

| Area                             | Status      | Evidence / blocker                                                                                                                                                                         |
| -------------------------------- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Provider documentation audit     | Complete    | Current official Railway and Render config, variables, Blueprint, health-check, and deploy-button documentation reviewed 2026-08-01                                                        |
| Repository architecture audit    | Complete    | `Dockerfile.gateway` and `packages/gateway/src/config.ts` are the production OAuth path; the root MCP image is intentionally unsuitable for public shared-key hosting                      |
| Plan and progress trail          | Complete    | Separate plan and this progress document created before implementation                                                                                                                     |
| Runtime portability              | Complete    | Provider public-origin and `PORT` discovery implemented with explicit TNL settings taking precedence; malformed/insecure provider origins are rejected                                     |
| Railway manifest                 | Complete    | `railway.json` uses `Dockerfile.gateway`, `/readyz`, bounded restart, deploy overlap, and draining; validates against the live Railway schema                                              |
| Render Blueprint                 | Complete    | `render.yaml` uses the gateway image, Render's `free` plan, `/readyz`, disabled automatic deployment, and `sync: false` for every required user-supplied value                             |
| Local qualification              | Complete    | Formatting, gateway tests (23), manifest tests (3), gateway build, live Railway schema, YAML parse, image build, provider-port health/readiness canary, and fail-closed startup all passed |
| Railway account/setup            | In progress | TNL-owned account authenticated and terms accepted; 30-day/$5 trial is active. Repository setup is blocked on installing the Railway GitHub App for only `bekirdag/tnl-intelligence`.      |
| Railway clean canary/publication | Blocked     | After repository authorization, requires configured non-production control dependencies. Only free Trial/Free credits are permitted; exhaustion must suspend service instead of charging.  |
| Render account/setup             | In progress | Account exists, but the live dashboard still requires verification of the email sent to `bekir@piyote.com`. No service or payment method has been created.                                 |
| Render clean canary/button       | Blocked     | Requires a valid email verification/sign-in, provider-side Blueprint validation, and configured non-production control dependencies; only the free instance is permitted.                  |

## Audit notes

- The current gateway production contract requires OAuth issuer/introspection,
  access, capability, quota, disable, audit, identity health, control health, and
  workload-token configuration. A deployment that only starts a container is not
  complete.
- Railway supplies `RAILWAY_PUBLIC_DOMAIN`; Render supplies
  `RENDER_EXTERNAL_URL` / `RENDER_EXTERNAL_HOSTNAME`; both providers expose
  `PORT`. The runtime can use these documented values without hardcoded domains.
- The operator requires zero spend. Railway's trial reverts to a Free plan with
  monthly free credit; Render offers Free web services. No payment method or paid
  upgrade will be configured. Free-limit suspension is accepted. Render Free
  spin-down means it is not an always-on production replacement.
- Docdex resolved this repository fingerprint to the stale alias
  `/Users/bekirdag/Documents/tnl-intelligence`, whose index contains zero files.
  AST/symbol data were therefore unavailable and the impact graph was empty.
  Direct source inspection and focused tests are being used conservatively; the
  alias/index defect is not treated as positive impact evidence.
- The local-model manifest drafting attempt did not return within its bounded
  execution window and was terminated; provider schemas and repository truth
  remain the implementation source of record.

## Local qualification evidence

- `npm run test --workspace @theneuralledger/gateway`: 23/23 passed.
- `node --test test/deployment/railway-render.test.mjs`: 3/3 passed.
- `npm run build --workspace @theneuralledger/gateway`: passed.
- `npx prettier --check ...`: all changed provider/runtime files passed.
- `railway.json`: passed AJV validation against the live
  `https://railway.com/railway.schema.json` contract.
- `render.yaml`: parsed successfully as YAML; the Render CLI is not installed on
  this host, so provider-side Blueprint validation remains part of the clean
  account canary.
- Render's live Blueprint planner found the repository manifest and correctly
  rejected `maxShutdownDelaySeconds` because that field is unsupported on Free
  services. The field was removed and an automated regression assertion added.
- `docker build -f Dockerfile.gateway`: passed, image
  `sha256:5a86d22a45c1f62e247934fbe5d4b36cb3355a30c113be342aa72683b5f650c3`.
- A container using only provider `PORT=17319` served both `/healthz` and
  `/readyz` successfully in explicit development-canary mode.
- Production-mode startup with a Railway public domain but missing control-plane
  configuration exited non-zero on the first required value
  (`TNL_GATEWAY_AUTHORIZATION_SERVERS`), confirming fail-closed behavior.
- Image construction reported existing npm audit findings (runtime install: two
  moderate; build install: two moderate and three high). They were not silently
  auto-fixed because dependency changes are outside this deployment-manifest
  work and can require compatibility review.

## Publication gate

Do not add a public Railway or Render button yet. The broader one-click promise
remains gated on documented public onboarding for the external identity/control
dependencies and two clean provider canaries with rollback evidence.
