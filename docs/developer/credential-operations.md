# Credential Operations

Developer keys use a non-secret `tnl_dev_<prefix>` identifier and a high-entropy
secret. The secret appears only in create and rotate responses. TNL stores a
salted scrypt verifier, owner, tenant, scopes, status, timestamps, and rotation
lineage; list responses never include a verifier, salt, or secret.

Creation is bounded by active-key, lifetime, and daily creation limits. Rotate,
revoke, delete, and account deletion require recent authentication. Rotation
revokes the predecessor before the replacement is returned. Account deletion
revokes and deletes every owned credential and schedules any production audit
metadata for policy-governed deletion.

Never place a key in a URL, committed environment, Postman export, support ticket,
browser storage, analytics event, screenshot, or log. Use the platform secret
manager for deployed services.
