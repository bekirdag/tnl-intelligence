# Rollback Rehearsal

The automated rehearsal writes `.artifacts/tool-10/rollback-evidence.json` and
must pass before the technical release decision can be `go`.

| Change                       | Stable rollback state                                                                      | Verification                                                                         |
| ---------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------ |
| MCP server/gateway upgrade   | Prior local bundle and gateway configuration restored                                      | Health, auth rejection, discovery, and one read-only call pass                       |
| Research skill/model upgrade | Previous skill catalog enabled; faulty version disabled                                    | Deterministic evaluation passes and saved-result schema remains readable             |
| Webhook dispatcher change    | Dispatcher paused with outbox intact, then prior worker resumed                            | Pending event replays once by idempotency key; no committed event is lost            |
| Adapter/connector withdrawal | Host-specific archive removed                                                              | Generic MCP or REST operation returns the equivalent structured result               |
| Quant feature change         | Derived output removed and rebuilt from immutable observations using prior feature version | Manifest and historical snapshot hashes reproduce; source revisions remain untouched |
| Credential change            | Grant/key revoked, then a new authorization established                                    | Old credential fails immediately; new credential is tenant-scoped                    |
| Schema change                | Prior compatible reader retained or versioned forward-fix applied                          | Contract matrix and clean-consumer tests pass before traffic resumes                 |

## Procedure

1. Record candidate ID, current version, rollback identifier, and affected data
   stores.
2. Stop only the downstream component being changed. TNL article publication
   remains isolated and available.
3. Preserve committed outbox entries, immutable quant observations, and prior
   signed artifact indexes.
4. Restore the previous version or disable the new feature flag.
5. Run health, authentication, representative operation, reconciliation, and
   observability checks.
6. Resume bounded traffic, verify alert recovery, and attach the machine-readable
   rehearsal record to the evidence index.

Rollback is rejected if it requires deleting committed source data, bypassing
tenant authorization, disabling TLS validation, accepting an unsigned event, or
manually editing production data without an auditable migration.
