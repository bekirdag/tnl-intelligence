import { TnlClient } from '@theneuralledger/sdk';

const apiKey = process.env.TNL_API_KEY;
if (!apiKey) throw new Error('TNL_API_KEY is required');

const client = new TnlClient({ apiKey });
const page = await client.searchNews({
  query: 'semiconductor export restrictions',
  publishedSince: new Date(Date.now() - 7 * 86_400_000).toISOString(),
  pageSize: 50,
  include: ['sources', 'claims'],
});

for (const story of page.data) {
  console.log({
    title: story.title,
    assets: story.impactedAssets,
    paths: story.impactPaths,
    confidence: story.truthPosterior,
  });
}
