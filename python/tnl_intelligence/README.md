# tnl-intelligence

Typed synchronous and asynchronous Python clients for The Neural Ledger event and evidence intelligence API.

```python
import os
from tnl_intelligence import TnlClient

with TnlClient(os.environ["TNL_API_KEY"]) as client:
    for story in client.iterate_news(published_since="2026-07-01T00:00:00Z"):
        print(story.title, story.impacted_assets)
```

```python
import os
from tnl_intelligence import AsyncTnlClient

async with AsyncTnlClient(os.environ["TNL_API_KEY"]) as client:
    page = await client.search_news("semiconductor export restrictions")
```

TNL supplies event, claim, source, contradiction, entity, and impact-path intelligence. The `/v1/markets` response is contextual display data, not an execution-grade quote feed.

## Webhook Verification

Verify the exact raw request bytes before parsing JSON:

```python
from tnl_intelligence import verify_webhook

verified = verify_webhook(raw_body, headers, {key_id: webhook_secret})
```

Persist delivery IDs for the replay window before performing consumer side
effects. The helper accepts a mutable delivery-ID set for local tests; production
consumers should use an atomic durable claim.

## Point-in-Time Quant Research

Install optional engines without adding them to the base SDK:

```bash
python -m pip install 'tnl-intelligence[quant,notebooks]'
```

```python
from tnl_intelligence.quant.lake import RevisionLake
from tnl_intelligence.quant.sample import sample_observations
from tnl_intelligence.quant.temporal import parse_utc

lake = RevisionLake("./data/tnl")
lake.ingest(sample_observations())
snapshot = lake.snapshot(as_of=parse_utc("2026-06-08T00:00:00Z"))
```

The toolkit preserves immutable revisions, UTC availability boundaries,
deterministic manifests, leakage findings, optional Parquet/DuckDB/dataframe
adapters, event studies with user-supplied outcomes, and executable synthetic
notebooks. It does not execute or recommend trades. See the
[quantitative research toolkit guide](../../docs/quant-research-toolkit.md).
