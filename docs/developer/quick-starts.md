# Developer Quick Starts

Set the local sample origin once:

```bash
export TNL_BASE_URL=http://127.0.0.1:7320
```

## curl

```bash
curl --fail --silent --show-error \
  "$TNL_BASE_URL/v1/search?q=semiconductor&page_size=2"
```

Follow `page.next_cursor` with `cursor=<value>`. A story revision is identified by
its stable `id`, `revision`, and `updatedAt` fields.

## TypeScript

```bash
npm pack --workspace @theneuralledger/sdk --pack-destination .artifacts
npm install .artifacts/theneuralledger-sdk-0.1.0.tgz
TNL_API_KEY=sample-not-a-secret node examples/onboarding/typescript.mjs
```

## Python

```bash
python3 -m build python/tnl_intelligence
python3 -m venv .artifacts/onboarding-python
.artifacts/onboarding-python/bin/pip install python/tnl_intelligence/dist/*.whl
TNL_API_KEY=sample-not-a-secret \
  .artifacts/onboarding-python/bin/python examples/onboarding/python.py
```

## CLI

```bash
npm pack --workspace @theneuralledger/cli --pack-destination .artifacts
npm install .artifacts/theneuralledger-cli-0.1.0.tgz
TNL_API_KEY=sample-not-a-secret npx tnl latest --limit 2 --json
```

## MCP

Pack `@theneuralledger/sdk` and `@theneuralledger/mcp`, install both tarballs in a
clean directory, set the same sample base URL and placeholder sample key, then run
`tnl-mcp`. The placeholder is accepted only by the static local server; do not use
shared placeholder credentials against TNL.
