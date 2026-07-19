# Developer Concepts

- **Story:** a revisioned TNL Bot intelligence record, not a raw source article.
- **Source:** provenance for a claim, with publication time and attribution URL.
- **Claim:** an atomic statement with evidence status and source links.
- **Revision:** an immutable change to a story as evidence develops.
- **Entity:** an organization, person, place, or other named object in an event.
- **Asset:** a market symbol linked to an event; TNL quotes are context only.
- **Impact path:** a causal chain from an event toward downstream effects.
- **Time:** API timestamps use ISO 8601 UTC; quotas reset at the displayed UTC time.

The static dataset includes verified, partially verified, contradiction, empty,
pagination, entity, asset, impact-path, and source examples. It is synthetic and
must never be presented as live news.
