# TNL Developer Start

The local developer service exposes the canonical OpenAPI snapshot, a static
synthetic dataset, a sample-first explorer, credential lifecycle controls, usage
rollups, and generated Postman assets without requiring public package registries.

Start it from the repository root:

```bash
npm run build --workspace @theneuralledger/onboarding
TNL_ONBOARDING_PORT=7320 node packages/onboarding/dist/bin.js
```

Open `http://127.0.0.1:7320`. The explorer defaults to `/v1/sample/news`, which is
static, CC0-licensed synthetic data and cannot fall through to production.

## First Success

```bash
curl --fail --silent --show-error \
  'http://127.0.0.1:7320/v1/sample/news?page_size=2'
```

Every sample response carries `X-TNL-Data-Mode: static-sample`. Use
`/openapi.json` for the canonical contract and `/postman/collection.json` plus
`/postman/environment.json` for public-safe Postman assets.

## Local Packages

JavaScript examples install workspace tarballs produced with `npm pack`; Python
examples install the wheel from `python/tnl_intelligence/dist`. No quick start
depends on npm or PyPI publication. See [Quick Starts](quick-starts.md).

## Navigation

- [Concepts](concepts.md)
- [Quick Starts](quick-starts.md)
- [Errors and Quotas](errors-and-quotas.md)
- [Credential Operations](credential-operations.md)
- [Security and Support](security-and-support.md)
