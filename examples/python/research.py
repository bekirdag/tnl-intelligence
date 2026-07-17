import os
from datetime import UTC, datetime, timedelta

from tnl_intelligence import TnlClient


with TnlClient(os.environ["TNL_API_KEY"]) as client:
    page = client.search_news(
        "semiconductor export restrictions",
        published_since=(datetime.now(UTC) - timedelta(days=7)).isoformat(),
        page_size=50,
        include=["sources", "claims"],
    )
    for story in page.data:
        print(story.title, story.impacted_assets, story.impact_paths, story.truth_posterior)
