import os

from tnl_intelligence import TnlClient


with TnlClient(
    os.environ.get("TNL_API_KEY", "sample-not-a-secret"),
    base_url=os.environ.get("TNL_BASE_URL", "http://127.0.0.1:7320"),
) as client:
    page = client.list_news(page_size=2)
    if not page.data or not page.data[0].sources:
        raise RuntimeError("Sample contract mismatch")
    print({"id": page.data[0].id, "source_count": len(page.data[0].sources)})
