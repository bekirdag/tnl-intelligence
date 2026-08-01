# TNL Railway and Render Deployment Plan

Date: 2026-08-01

## Goal

Prepare secure, provider-native deployment definitions for the production OAuth
MCP gateway, qualify them locally, and publish one-click surfaces only after a
clean provider canary proves the complete identity and control-plane path.

## Non-negotiable boundaries

- Deploy `Dockerfile.gateway`, never the single-user environment-key MCP image.
- Keep production OAuth, tenant, quota, disable, capability, audit, and readiness
  checks enabled and fail closed when a required dependency is absent.
- Store client secrets and workload tokens only in provider secret stores.
- Do not embed a TNL API key, production token, internal hostname, or reusable
  credential in source, templates, examples, logs, or screenshots.
- Use `/readyz` for provider health checks; `/healthz` proves liveness only.
- Do not add public deployment buttons or claim marketplace availability until a
  clean-account canary and rollback rehearsal pass.
- Use only provider free tiers/credits. Never add a payment method, select a paid
  subscription, enable automatic upgrades, or incur overage charges; suspension
  at a free limit is the required fail-safe.

## Work packages

1. Provider contract audit
   - Verify current Railway config-as-code, template, variables, health-check,
     and public-domain behavior.
   - Verify current Render Blueprint, prompted-secret, external-URL, port,
     health-check, and deploy-button behavior.
2. Runtime portability
   - Resolve the public gateway origin from the explicit TNL setting first, then
     Render or Railway's documented runtime variables.
   - Resolve the listen port from `TNL_GATEWAY_PORT`, then provider `PORT`, while
     retaining the existing local fallback.
   - Reject malformed provider URLs and preserve HTTPS-only production rules.
3. Deployment manifests
   - Add `railway.json` using `Dockerfile.gateway`, `/readyz`, bounded restart,
     and deploy overlap/drain settings.
   - Add `render.yaml` with a Docker web service, `/readyz`, disabled automatic
     redeployment, and prompted values for every required user-supplied setting.
4. Documentation and automated qualification
   - Add a deployment guide that explains every dependency, variable, cost
     boundary, canary, rollback, and the publication gate.
   - Add tests for provider origin/port discovery, precedence, malformed input,
     manifest schemas, required variables, and credential absence.
   - Run gateway tests/typecheck/build, schema validation, container health and
     fail-closed startup checks, secret scans, and the repository pre-commit gate.
5. Provider publication
   - Create TNL-owned Railway and Render validation workspaces only with owner
     authorization for sign-in and terms; do not configure billing.
   - Deploy bounded non-production dependencies, exercise OAuth discovery,
     denied/allowed calls, readiness, restart, and rollback.
   - Publish the Railway template and Render button only after a second clean
     deployment passes; record the public URLs and evidence in `ACCOUNTS.md`.

## Success criteria

- Provider manifests validate against current official schemas.
- Missing secrets or dependencies prevent readiness and production activation.
- No credential is present in the repository or generated deployment plan.
- A clean Railway and Render deployment each pass `/readyz`, OAuth discovery,
  invalid-token denial, permitted read-only execution, restart, and rollback.
- Public buttons/listings are added only after the clean deployment gate passes.

## Rollback

- Before publication, remove or revert only the new provider manifests and
  portability changes; existing production MCP hosts remain independent.
- After publication, disable the provider route/template, revoke its workload
  credentials, and restore the previously qualified image or commit.
- Never roll back to shared-key authentication or relaxed readiness.
