# @theneuralledger/cli

Command-line access and an append-only foreground intelligence daemon for The Neural Ledger.

```bash
export TNL_API_KEY=tnl_...
npx -y @theneuralledger/cli latest
npx -y @theneuralledger/cli search "semiconductor export restrictions"
npx -y @theneuralledger/cli asset NVDA
npx -y @theneuralledger/cli daemon --interval 60
```

Commands: `latest`, `search`, `asset`, `status`, `watch`, `daemon`, `mcp`, and `serve`.

The daemon remains in the foreground so a process supervisor can manage it. It stores immutable JSONL revisions and atomic cursor state under `~/.tnl-intelligence` by default; set `TNL_STATE_DIR` or pass `--state-dir` to change the location. Cache, state, and lock files are private to the current user where the operating system supports POSIX permissions.

API keys are read only from `TNL_API_KEY`. There is deliberately no command-line API-key option because process arguments are commonly visible to other local users and monitoring systems.
