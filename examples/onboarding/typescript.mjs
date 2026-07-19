import { TnlClient } from '@theneuralledger/sdk';

const client = new TnlClient({
  apiKey: process.env.TNL_API_KEY || 'sample-not-a-secret',
  baseUrl: process.env.TNL_BASE_URL || 'http://127.0.0.1:7320',
  retries: 0,
});
const page = await client.listNews({ pageSize: 2 });
if (!page.data.length || !page.data[0].sources?.length) throw new Error('Sample contract mismatch');
console.log(JSON.stringify({ id: page.data[0].id, sourceCount: page.data[0].sources.length }));
