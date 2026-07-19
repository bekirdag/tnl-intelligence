# Publication Runbook

Package and registry publication requires owner-controlled accounts and trusted-publisher configuration. The repository workflows do not publish on ordinary pushes.

## npm

1. Create or confirm the public npm organization/scope `@theneuralledger`.
2. In npm, create trusted publishers for `@theneuralledger/sdk`, `@theneuralledger/mcp`, and `@theneuralledger/cli` using GitHub repository `bekirdag/tnl-intelligence`, workflow `release-npm.yml`, and environment `npm`.
3. Create the protected GitHub environment `npm` and require an owner approval.
4. Run the **Release npm packages** workflow manually with confirmation `0.1.0`. It validates and publishes SDK, MCP, then CLI with provenance.

## PyPI

1. Create a pending trusted publisher for project `tnl-intelligence` in PyPI.
2. Use owner `bekirdag`, repository `tnl-intelligence`, workflow `release-python.yml`, and environment `pypi`.
3. Create and protect the GitHub environment `pypi`.
4. Run the **Release Python package** workflow with confirmation `0.1.0`.

## MCP Registry

The registry name is `com.theneuralledger/intelligence`, so `theneuralledger.com` must authorize it.

1. Generate an Ed25519 key outside the repository: `openssl genpkey -algorithm Ed25519 -out key.pem`.
2. Derive the public key: `openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64`.
3. Add a TXT record at `theneuralledger.com`: `v=MCPv1; k=ed25519; p=PUBLIC_KEY`.
4. Extract the private hex value using the command in the official MCP Registry DNS-login guide.
5. Store it as the `MCP_DNS_PRIVATE_KEY` GitHub environment secret in protected environment `mcp-registry`.
6. Publish npm first, then run **Release MCP Registry metadata** with confirmation `0.1.0`.

`server.json` advertises only the npm stdio package. Add a remote URL only after a TLS and OAuth protected TNL-hosted MCP endpoint is deployed and tested.

## Container

The **Release container** workflow publishes `ghcr.io/bekirdag/tnl-intelligence`.
Run it manually only after the release commit is on `main`, the clean candidate
passes aggregate qualification, and the matching version tag exists. GitHub's
package permissions control visibility; no credentials beyond `GITHUB_TOKEN` are
embedded in the image.

For `0.1.0`:

1. Dispatch `release-container.yml` with version `0.1.0` from the qualified
   commit.
2. Wait for the workflow to complete and record its run URL.
3. Confirm GHCR exposes both `0.1.0` and `latest` for the same digest and make the
   package public when necessary.
4. Pull the versioned image and verify `/healthz` plus unauthenticated request
   rejection before announcing the release.

Rollback keeps immutable version evidence and moves or removes only `latest`
until a validated patch image is available.

## Local Release Checks

```bash
npm ci
npm run validate
npm run pack:check
.venv/bin/python -m build python/tnl_intelligence
docker build -t tnl-intelligence:local .
```
