# tnl-intelligence

Typed synchronous and asynchronous Python clients for The Neural Ledger event and evidence intelligence API.

```python
import os
from tnl_intelligence import TnlClient

with TnlClient(os.environ["TNL_API_KEY"]) as client:
    for story in client.iter_news(published_since="2026-07-01T00:00:00Z"):
        print(story.title, story.impacted_assets)
```

```python
import os
from tnl_intelligence import AsyncTnlClient

async with AsyncTnlClient(os.environ["TNL_API_KEY"]) as client:
    page = await client.search_news("semiconductor export restrictions")
```

TNL supplies event, claim, source, contradiction, entity, and impact-path intelligence. The `/v1/markets` response is contextual display data, not an execution-grade quote feed.
