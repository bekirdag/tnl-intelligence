# @theneuralledger/sdk

Typed, secret-safe TypeScript client for The Neural Ledger member API.

```ts
import { TnlClient } from '@theneuralledger/sdk';

const client = new TnlClient({ apiKey: process.env.TNL_API_KEY! });
const stories = await client.getAssetStories('BTC', {
  updatedSince: new Date(Date.now() - 86_400_000).toISOString(),
});
```

The SDK provides cursor iteration, bounded retries, request timeouts, rate-limit metadata, saved-search management, and Ledger AI Terminal access.
