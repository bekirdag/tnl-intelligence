# TNL Intelligence for Activepieces

Use The Neural Ledger's cited intelligence and read-only research workflows in
Activepieces flows and MCP-enabled agents.

## Install

In Activepieces, open **Settings → My Pieces → Install Piece** and enter:

```text
@theneuralledger/piece-tnl-intelligence
```

## Connect

Create a TNL API key at
[The Neural Ledger](https://theneuralledger.com/member) and add it to the
masked **TNL API Key** connection field. The key needs `tnl:read`; research
actions also need `tnl:research`.

The piece connects only to:

- `https://theneuralledger.com`
- `https://mcp.theneuralledger.com/mcp`

## Actions

- Search Intelligence
- Get Intelligence
- List Recent Changes
- Get Exposure
- Run Research
- Get Weekly Edition

All actions are read-only and return structured TNL evidence, source links, and
research output.

## Privacy and support

Inputs needed for a selected action are sent to The Neural Ledger. The piece
does not add its own persistence or logging. See the
[TNL privacy policy](https://theneuralledger.com/privacy),
[terms](https://theneuralledger.com/terms), and
[developer documentation](https://theneuralledger.com/developers).

Support: tnladmin@theneuralledger.com  
Source: https://github.com/bekirdag/tnl-intelligence
