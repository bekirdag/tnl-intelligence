# Deploy the TNL OAuth MCP Gateway on Railway or Render

These definitions deploy the production OAuth gateway from
`Dockerfile.gateway`. They are intended for operators who already provide the
identity and control-plane services listed below. They do not turn a TNL API key
into a shared hosted credential.

## Before deploying

Provide HTTPS endpoints for OAuth introspection, account/tenant access,
short-lived TNL capability issuance, distributed quota, emergency disable,
append-only audit, identity readiness, and control-plane readiness. The gateway
must receive a confidential introspection client and a separate service token.

| Variable                                  | Secret               | Requirement                                         |
| ----------------------------------------- | -------------------- | --------------------------------------------------- |
| `TNL_GATEWAY_AUTHORIZATION_SERVERS`       | No                   | Comma-separated OAuth issuer URLs                   |
| `TNL_GATEWAY_ISSUER`                      | No                   | Exact issuer expected in introspection results      |
| `TNL_GATEWAY_INTROSPECTION_URL`           | No                   | RFC 7662 HTTPS endpoint                             |
| `TNL_GATEWAY_INTROSPECTION_CLIENT_ID`     | Sensitive identifier | Confidential gateway client ID                      |
| `TNL_GATEWAY_INTROSPECTION_CLIENT_SECRET` | Yes                  | Introspection client secret                         |
| `TNL_GATEWAY_ACCESS_URL`                  | No                   | Identity-to-tenant and entitlement resolver         |
| `TNL_GATEWAY_CAPABILITY_URL`              | No                   | Short-lived, audience-bound capability broker       |
| `TNL_GATEWAY_QUOTA_URL`                   | No                   | Atomic quota decision endpoint                      |
| `TNL_GATEWAY_DISABLE_URL`                 | No                   | Global/tenant/client/principal/tool disable service |
| `TNL_GATEWAY_AUDIT_URL`                   | No                   | Append-only audit collector                         |
| `TNL_GATEWAY_IDP_HEALTH_URL`              | No                   | Unauthenticated IdP readiness URL                   |
| `TNL_GATEWAY_CONTROL_HEALTH_URL`          | No                   | Authenticated control-plane readiness URL           |
| `TNL_GATEWAY_SERVICE_TOKEN`               | Yes                  | Workload token for control services                 |

Set optional exact browser origins with `TNL_GATEWAY_ALLOWED_ORIGINS`. Configure
the research service only when its private HTTPS endpoint and dedicated workload
token are available; see [gateway operations](gateway-operations.md).

## Railway

`railway.json` selects `Dockerfile.gateway` and uses `/readyz`. In the Railway
template composer, enable public HTTP networking and create all variables in the
table above. Seal the two secrets. Use the service's
`RAILWAY_PUBLIC_DOMAIN`; the gateway derives its canonical HTTPS origin and uses
Railway's `PORT` automatically.

Use only Railway's free Trial/Free credits, do not add a payment method, and do
not upgrade to Hobby or another subscription. If the free credit is exhausted,
allow Railway to suspend the service. Do not publish the template until a fresh
project passes the qualification below and the free-tier limitations are stated
in the listing.

## Render

`render.yaml` creates a Frankfurt Free web service, disables automatic
redeployment, and prompts for every required operator value. Render supplies
`RENDER_EXTERNAL_URL` and `PORT`; the gateway uses them automatically. The
free instance can spin down after inactivity and is therefore a distribution
canary or demonstration surface, not the canonical always-on production MCP
endpoint. Do not add a payment method; if included usage is exhausted, allow
Render to suspend services/builds instead of incurring overage charges.

The public deploy button remains intentionally absent until a clean Blueprint
canary and rollback rehearsal pass.

## Qualification

1. Confirm `/healthz` and `/readyz` return `200`; treat `503` readiness as a
   failed deployment even when liveness passes.
2. Fetch both OAuth protected-resource metadata paths and verify the public
   resource and authorization-server URLs.
3. Verify missing, inactive, expired, wrong-issuer, and wrong-audience tokens are
   denied without leaking token material.
4. Invoke one permitted read-only tool and verify a scope-denied tool is rejected.
5. Stop and restart the service; repeat readiness and the permitted call.
6. Deploy a deliberately unhealthy configuration and confirm `/readyz` fails.
7. Restore the prior image/commit, revoke the canary workload credentials, and
   confirm the rollback becomes ready.
8. Delete the canary and repeat from a clean workspace before publishing a
   template or button.

Existing production hosts at `mcp.theneuralledger.com` and `mcp.tnl.st` are
independent of these templates and are not rollback targets for user deployments.
