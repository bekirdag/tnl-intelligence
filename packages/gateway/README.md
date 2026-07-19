# @theneuralledger/gateway

Hosted OAuth resource server and policy gateway for the read-only TNL MCP service.
It keeps external OAuth tokens separate from short-lived TNL upstream capabilities,
enforces tenant mappings and tool scopes, and emits redacted audit and metrics data.

Production mode requires HTTPS endpoints for token introspection, access mapping,
capability exchange, distributed quota enforcement, emergency disables, and audit
delivery. Development mode accepts explicit static credentials only when
`TNL_GATEWAY_MODE` is not `production`.

See [Gateway Operations](../../docs/gateway-operations.md) for configuration,
deployment, incident, rotation, and rollback procedures.
