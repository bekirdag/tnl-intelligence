# The Neural Ledger for Dify

The Neural Ledger plugin adds source-linked intelligence and evidence-first
research to Dify workflows, chatflows, and agents.

## Requirements

- Dify 1.11.4 or later
- A TNL API key with `tnl:read`
- `tnl:research` access for research tools
- Outbound HTTPS access to:
  - `https://theneuralledger.com`
  - `https://mcp.theneuralledger.com`

Create or manage an API key from the
[TNL member area](https://theneuralledger.com/member).

## Connection

Install the plugin, open its provider settings, and enter the API key in the
masked **TNL API Key** field. Dify stores the credential and provides it to the
plugin only while a tool is running. Credential validation calls the fixed TNL
account endpoint.

## Tools

- **Search Intelligence** — search source-linked stories with bounded cursor
  pagination.
- **Get Intelligence** — retrieve one stable story and its revision metadata.
- **List Recent Changes** — list published, revised, or retracted intelligence
  since an explicit timestamp.
- **Get Exposure** — retrieve stories linked to an entity, asset, or impact path.
- **Run Research** — run one enumerated evidence-first TNL research workflow.
- **Get Weekly Edition** — generate a cited weekly consequential-development
  edition.

All tools are read-only. Results remain structured and may include stable IDs,
revisions, timestamps, canonical URLs, source URLs, citations, claims,
verification state, confidence, and research status.

## Security Boundary

The plugin sends requests only to the fixed TNL API and MCP hosts listed above.
It does not accept arbitrary destination URLs, execute code or commands, access
files, operate a browser, write to TNL, or register webhooks. Requests have
bounded inputs and timeouts. Errors never include the API key or authorization
headers.

## Privacy and Support

- [Plugin privacy disclosure](PRIVACY.md)
- [TNL privacy policy](https://theneuralledger.com/privacy)
- [TNL terms](https://theneuralledger.com/terms)
- [Developer documentation](https://theneuralledger.com/developers)
- [Source repository](https://github.com/bekirdag/tnl-intelligence)
- Support: `tnladmin@theneuralledger.com`

