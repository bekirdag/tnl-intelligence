# Foreground Daemon

Run the local append-only cache under a process supervisor:

```bash
TNL_API_KEY=... tnl daemon --interval 60
```

Every cycle reports four numbered `Running`/`Complete` stages: state load, incremental fetch, revision deduplication, and atomic commit. `events.jsonl` preserves each distinct story revision. `state.json` stores the last update timestamp and a bounded fingerprint set. Files use mode `0600` and the directory uses `0700` where POSIX permissions are available.

The daemon remains in the foreground and responds to `SIGINT` and `SIGTERM`. Its exclusive lock prevents two processes from writing the same cache. A lock whose process no longer exists is reclaimed; graceful and error exits remove the active lock.

Use `tnl daemon --once` for scheduled polling. The [systemd example](../examples/systemd/tnl-intelligence.service) shows a persistent user service.
