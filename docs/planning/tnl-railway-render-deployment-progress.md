# TNL Railway and Render Deployment Progress

Date: 2026-08-01
Plan: [TNL Railway and Render Deployment Plan](tnl-railway-render-deployment-plan.md)
Status: Blocked — no verified non-production identity/control plane exists for safe provider canaries

| Area                             | Status   | Evidence / blocker                                                                                                                                                                           |
| -------------------------------- | -------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Provider documentation audit     | Complete | Current official Railway and Render config, variables, Blueprint, health-check, and deploy-button documentation reviewed 2026-08-01                                                          |
| Repository architecture audit    | Complete | `Dockerfile.gateway` and `packages/gateway/src/config.ts` are the production OAuth path; the root MCP image is intentionally unsuitable for public shared-key hosting                        |
| Plan and progress trail          | Complete | Separate plan and this progress document created before implementation                                                                                                                       |
| Runtime portability              | Complete | Provider public-origin and `PORT` discovery implemented with explicit TNL settings taking precedence; malformed/insecure provider origins are rejected                                       |
| Railway manifest                 | Complete | `railway.json` uses `Dockerfile.gateway`, `/readyz`, bounded restart, deploy overlap, and draining; validates against the live Railway schema                                                |
| Render Blueprint                 | Complete | `render.yaml` uses the gateway image, Render's `free` plan, `/readyz`, disabled automatic deployment, and `sync: false` for every required user-supplied value                               |
| Local qualification              | Complete | Formatting, gateway tests (23), manifest tests (3), gateway build, live Railway schema, YAML parse, image build, provider-port health/readiness canary, and fail-closed startup all passed   |
| Railway account/setup            | Complete | TNL-owned account authenticated; GitHub App access is restricted to `bekirdag/tnl-intelligence`; free-trial project `glistening-passion` and service `tnl-intelligence` were created.        |
| Railway image deployment         | Complete | Deployment `25630c83-4d15-4e7d-8b83-a44ee456db60` built and pushed the gateway image, then reached terminal `Failed` on healthcheck because required configuration was intentionally absent. |
| Railway clean canary/publication | Blocked  | No externally reachable non-production identity/control plane exists to issue safe credentials. Production Keycloak and production secrets are explicitly excluded.                          |
| Render account/setup             | Complete | The emailed activation URL was already invalid/expired, but GitHub sign-in completed successfully for `bekir@piyote.com`; the Render dashboard and Blueprint flow are accessible.            |
| Render Blueprint validation      | Complete | The live planner found `render.yaml` on `main`, accepted the Free service after removing the unsupported shutdown-delay field, and displayed all required prompted variables.                |
| Render clean canary/button       | Blocked  | No externally reachable non-production identity/control plane exists to issue safe credentials. Production Keycloak and production secrets are explicitly excluded.                          |

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
- Commits `a5f081f` and `968a60f` were pushed to `main`. The live Render planner
  then accepted the corrected Free Blueprint and presented all thirteen
  `sync: false` values without reporting a schema or tier error.
- Railway GitHub App access was granted only to `bekirdag/tnl-intelligence`.
  Project `glistening-passion` (`f8cb8700-eef7-45a0-88ba-5b09910861cf`),
  production environment `b3632e57-7eff-43dd-958c-ec915aa663dc`, and service
  `tnl-intelligence` (`0bf4e2e5-23ba-44f4-a352-88c5cf46c4d8`) were created
  without adding a payment method or selecting a paid plan.
- Railway deployment `25630c83-4d15-4e7d-8b83-a44ee456db60` completed the
  Docker build and image push with digest
  `sha256:fd63a4a3d257c25405c863d8aba4d7fefd29c95dfc2688934c3eb5128d5c44da`.
  Its deploy logs then reported `TNL_GATEWAY_PUBLIC_URL is required`, proving
  that the live provider deployment also fails closed before any unsecured
  runtime becomes ready. Railway subsequently marked it terminal `Failed` with
  `Healthcheck failure` after 05:38. The service remains unexposed.
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

## Developer-reported blocker verification

The TNL developer reported the following on 2026-08-01. These facts have not
been independently re-probed from this workstation and are recorded as a
developer handoff rather than as observed production evidence:

- No dedicated canary credentials were created because there is no verified,
  externally reachable non-production identity/control plane from which to
  issue them.
- Railway has only its existing production-named environment; no staging/canary
  GitHub environment or gateway variables exist.
- Render has only the production-mode Blueprint definition and no verified
  canary service.
- Candidate staging/canary HTTPS endpoints were either nonexistent or failed
  TLS readiness.
- The only reachable identity surface was production Keycloak, which was not
  used.
- `.creds` remained unchanged at mode `0600` and contains none of the requested
  gateway variables. No production secret was copied or exposed.

## Publication gate

Do not add a public Railway or Render button yet. The broader one-click promise
remains gated on documented public onboarding for the external identity/control
dependencies and two clean provider canaries with rollback evidence. Work may
resume only after a dedicated, externally reachable non-production identity and
control plane passes TLS/readiness checks and can issue least-privilege,
revocable canary credentials. Production Keycloak and production credentials
must not be used to bypass this gate.
