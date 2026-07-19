# Errors And Quotas

| Status | Meaning                                                       | Next action                                         |
| ------ | ------------------------------------------------------------- | --------------------------------------------------- |
| `401`  | Missing, malformed, revoked, expired, or wrong key            | Create or rotate a key, then use the one-time value |
| `403`  | Scope, tenant, entitlement, or recent-auth requirement failed | Request the minimum scope or reauthenticate         |
| `404`  | Resource or owned credential was not found                    | Refresh the list and use a returned ID              |
| `429`  | Daily, creation, or concurrency quota exhausted               | Wait until `Retry-After` or the displayed UTC reset |
| `5xx`  | A required dependency failed                                  | Check status and retry with bounded backoff         |

Empty `data` is a successful result, not an error. Treat revisions as new evidence
for the same story identity. Do not retry authentication or authorization errors.
