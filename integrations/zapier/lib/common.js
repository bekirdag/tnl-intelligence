const { createHmac, timingSafeEqual } = require('node:crypto');

const EVENT_TYPES = new Set([
  'intelligence.published',
  'intelligence.updated',
  'intelligence.retracted',
  'intelligence.impact_changed',
  'digest.weekly_published',
]);

const clean = (value) =>
  Object.fromEntries(Object.entries(value).filter(([, item]) => item != null && item !== ''));

const clientFor = async (z, bundle) => ({
  execute: async ({ operation, input }) => {
    switch (operation) {
      case 'search_intelligence': {
        const page = await api(z, bundle, '/v1/search', {
          q: required(input.query, 'query'),
          ...pageQuery(input),
        });
        return result(operation, normalizePage(page, Boolean(input.includeBody)));
      }
      case 'get_intelligence': {
        const story = await api(z, bundle, `/v1/news/${encodeURIComponent(identifier(input.id))}`, {
          include: input.includeBody ? 'sources,claims' : 'sources',
        });
        return result(operation, normalizeStory(record(story), Boolean(input.includeBody)));
      }
      case 'list_recent_changes': {
        const page = await api(z, bundle, '/v1/news', {
          ...pageQuery(input),
          updated_since: timestamp(input.since, 'since'),
          sort: 'pipeline',
        });
        return result(operation, normalizePage(page));
      }
      case 'get_exposure': {
        const resources = { entity: 'entities', asset: 'assets', impact_path: 'impact-paths' };
        const resource = resources[input.kind];
        if (!resource) throw new Error('Exposure kind is invalid');
        const page = await api(
          z,
          bundle,
          `/v1/${resource}/${encodeURIComponent(identifier(input.value))}/stories`,
          pageQuery(input),
        );
        return result(operation, normalizePage(page));
      }
      case 'run_research': {
        const task = researchTask({
          workflowId: required(input.workflowId, 'workflowId'),
          question: required(input.question, 'question'),
          ...(input.from ? { from: timestamp(input.from, 'from') } : {}),
          ...(input.to ? { to: timestamp(input.to, 'to') } : {}),
        });
        return result(operation, await research(z, bundle, task));
      }
      case 'get_research_result':
        return result(
          operation,
          await researchResult(z, bundle, identifier(input.resultId)),
        );
      case 'get_weekly_edition': {
        const to = input.weekEnding ? timestamp(input.weekEnding, 'weekEnding') : new Date().toISOString();
        const task = researchTask({
          workflowId: 'weekly-consequential',
          question: 'What were the most consequential developments in this period?',
          from: new Date(Date.parse(to) - 7 * 86_400_000).toISOString(),
          to,
        });
        return result(operation, await research(z, bundle, task));
      }
      default:
        throw new Error('Unsupported TNL operation');
    }
  },
});

const createSubscription = async (z, bundle, input) => {
  const payload = record(
    await jsonRequest(z, {
      method: 'POST',
      url: endpoint(
        bundle.authData.webhook_url || 'https://hooks.theneuralledger.com',
        '/v1/webhooks/subscriptions',
      ),
      headers: authorization(bundle),
      body: input,
    }),
  );
  const data = record(payload.data);
  const subscription = record(data.subscription);
  return {
    id: required(subscription.id, 'subscription id'),
    secret: required(data.secret, 'webhook secret'),
    keyId: required(subscription.activeKeyId, 'webhook key id'),
  };
};

const deleteSubscription = async (z, bundle, id) => {
  await jsonRequest(z, {
    method: 'DELETE',
    url: endpoint(
      bundle.authData.webhook_url || 'https://hooks.theneuralledger.com',
      `/v1/webhooks/subscriptions/${encodeURIComponent(identifier(id))}`,
    ),
    headers: authorization(bundle),
  });
};

const processWebhook = ({ rawBody, headers, secret, now = Math.floor(Date.now() / 1_000) }) => {
  const deliveryId = header(headers, 'tnl-webhook-id');
  const timestampText = header(headers, 'tnl-webhook-timestamp');
  const signatureText = header(headers, 'tnl-webhook-signature');
  header(headers, 'tnl-webhook-key-id');
  if (!/^dlv_[A-Za-z0-9_-]{12,100}$/.test(deliveryId)) throw new Error('Invalid webhook ID');
  const unixTime = Number(timestampText);
  if (!Number.isInteger(unixTime) || Math.abs(now - unixTime) > 300)
    throw new Error('Webhook timestamp is invalid');
  const supplied = signatureText.match(/^v1=([a-f0-9]{64})$/)?.[1];
  if (!supplied) throw new Error('Webhook signature is invalid');
  const raw = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody, 'utf8');
  const expected = createHmac('sha256', decodeSecret(secret))
    .update(Buffer.from(`v1.${unixTime}.${deliveryId}.`, 'utf8'))
    .update(raw)
    .digest();
  const actual = Buffer.from(supplied, 'hex');
  if (actual.length !== expected.length || !timingSafeEqual(actual, expected))
    throw new Error('Webhook signature is invalid');
  const envelope = record(JSON.parse(raw.toString('utf8')));
  const resource = record(envelope.resource);
  const data = record(envelope.data);
  const eventType = required(envelope.type, 'event type');
  if (!EVENT_TYPES.has(eventType)) throw new Error('Webhook event type is invalid');
  const revision = number(resource.revision);
  if (!revision || revision < 1) throw new Error('Webhook revision is invalid');
  return {
    id: `${required(envelope.id, 'event id')}:${revision}`,
    deliveryId,
    type: eventType,
    occurredAt: required(envelope.occurredAt, 'occurredAt'),
    publishedAt: required(envelope.publishedAt, 'publishedAt'),
    resourceId: required(resource.id, 'resource id'),
    revision,
    canonicalUrl: string(resource.url),
    summary: string(data.summary),
    categories: strings(data.categories),
    geographies: strings(data.geographies),
    entities: strings(data.entities),
    assets: strings(data.assets),
    impactPaths: strings(data.impactPaths),
    confidence: number(data.confidence),
    envelope,
  };
};

const api = async (z, bundle, path, params = {}) =>
  jsonRequest(z, {
    method: 'GET',
    url: endpoint(bundle.authData.api_url || 'https://theneuralledger.com', path),
    headers: authorization(bundle),
    params: clean(params),
  });

const research = async (z, bundle, task) => {
  const payload = record(
    await jsonRequest(z, {
      method: 'POST',
      url: endpoint(
        bundle.authData.research_url || 'https://research.theneuralledger.com',
        '/api/research/runs',
      ),
      headers: authorization(bundle),
      body: { task },
    }),
  );
  if (!payload.data) throw new Error('The research response is invalid');
  return payload.data;
};

const researchResult = async (z, bundle, resultId) => {
  const payload = record(
    await jsonRequest(z, {
      method: 'GET',
      url: endpoint(
        bundle.authData.research_url || 'https://research.theneuralledger.com',
        `/api/research/runs/${encodeURIComponent(resultId)}`,
      ),
      headers: authorization(bundle),
    }),
  );
  if (!payload.data) throw new Error('The research response is invalid');
  return payload.data;
};

const jsonRequest = async (z, options) => {
  const response = await z.request(options);
  response.throwForStatus();
  return response.status === 204 ? undefined : response.data;
};

const researchTask = ({ workflowId, question, from, to }) => {
  const types = {
    'what-changed': 'what_changed',
    'compare-sources': 'source_comparison',
    'validate-event': 'event_validation',
    'asset-exposure': 'asset_entity_exposure',
    'operational-risk': 'geopolitical_operational_risk',
    'weekly-consequential': 'weekly_consequential',
  };
  const taskType = types[workflowId];
  if (!taskType) throw new Error('Research workflow is invalid');
  const end = to || new Date().toISOString();
  const start = from || new Date(Date.parse(end) - 7 * 86_400_000).toISOString();
  return {
    schemaVersion: '1.0',
    taskId: `task_zapier_${Date.now().toString(36)}`,
    taskType,
    question: question.trim(),
    asOf: end,
    timeWindow: { from: start, to: end },
    depth: 'standard',
    sourcePolicy: {
      version: 'research-sources-1',
      requirePrimary: taskType === 'event_validation',
      minimumIndependentSources: taskType === 'weekly_consequential' ? 3 : 2,
      freshnessMs: 7 * 86_400_000,
    },
    budget: {
      maxToolCalls: 12,
      maxDurationMs: 45_000,
      maxInputTokens: 24_000,
      maxOutputTokens: 4_000,
      maxSources: 20,
      maxCostUsd: 0.25,
    },
    outputFormat: 'json',
    locale: 'en',
  };
};

const normalizePage = (value, includeBody = false) => {
  const page = record(value);
  const metadata = record(page.page);
  const items = Array.isArray(page.data)
    ? page.data.map((story) => normalizeStory(record(story), includeBody))
    : [];
  return {
    items,
    nextCursor: string(metadata.next_cursor),
    asOf: iso(page.lastSyncAt) || new Date().toISOString(),
    count: items.length,
  };
};

const normalizeStory = (story, includeBody = false) => {
  const id = required(story.id, 'story id');
  const sources = Array.isArray(story.sources) ? story.sources.map(record) : [];
  return {
    id,
    revision: number(story.revision) || number(story.version) || 1,
    title: string(story.title),
    summary: string(story.excerpt),
    category: string(story.category),
    canonicalUrl:
      string(story.canonicalUrl) ||
      `https://theneuralledger.com/news/${encodeURIComponent(string(story.slug) || id)}`,
    eventAt: iso(story.date),
    publishedAt: iso(story.publishedAt),
    updatedAt: iso(story.updatedAt),
    retrievedAt: new Date().toISOString(),
    status: string(story.storyStatus),
    impact: string(story.impact),
    confidence: number(story.truthPosterior),
    entities: unique([...strings(story.passiveEntities), ...strings(story.entities)]),
    assets: unique(strings(story.impactedAssets)),
    impactPaths: unique(strings(story.impactPaths)),
    citations: sources.flatMap((source) => {
      const url = string(source.url);
      return url ? [{ label: string(source.name) || string(source.label) || 'Source', url }] : [];
    }),
    ...(includeBody && typeof story.body === 'string' ? { body: story.body } : {}),
  };
};

const pageQuery = (input) => {
  const size = number(input.pageSize) || 50;
  if (!Number.isInteger(size) || size < 1 || size > 100) throw new Error('Page size is invalid');
  return clean({
    page_size: size,
    cursor: string(input.cursor),
    published_since: input.from ? timestamp(input.from, 'from') : undefined,
    published_until: input.to ? timestamp(input.to, 'to') : undefined,
    category: string(input.category),
    country: string(input.geography),
    entity: string(input.entity),
    impact_path: string(input.impactPath),
  });
};

const endpoint = (base, path) => {
  const url = new URL(required(base, 'service URL'));
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Service URL is invalid');
  return `${url.toString().replace(/\/$/, '')}${path}`;
};

const authorization = (bundle) => ({
  authorization: `Bearer ${required(bundle.authData.api_key, 'API key')}`,
  accept: 'application/json',
  'content-type': 'application/json',
  'user-agent': 'tnl-intelligence-zapier/0.1.0',
});

const header = (headers, name) => {
  const entry = Object.entries(headers || {}).find(([key]) => key.toLowerCase() === name);
  if (!entry || typeof entry[1] !== 'string' || entry[1].length > 500)
    throw new Error(`Missing ${name} header`);
  return entry[1];
};

const decodeSecret = (value) => {
  if (!/^[A-Za-z0-9_-]{43,128}$/.test(value)) throw new Error('Webhook secret is invalid');
  const secret = Buffer.from(value, 'base64url');
  if (secret.length < 32 || secret.length > 64) throw new Error('Webhook secret is invalid');
  return secret;
};

const result = (operation, data) => ({ operation, data });
const required = (value, field) => {
  const output = string(value);
  if (!output) throw new Error(`${field} is required`);
  return output;
};
const identifier = (value) => {
  const output = required(value, 'identifier');
  if (output.length > 256) throw new Error('identifier is invalid');
  return output;
};
const timestamp = (value, field) => {
  const parsed = Date.parse(required(value, field));
  if (!Number.isFinite(parsed)) throw new Error(`${field} must be an ISO timestamp`);
  return new Date(parsed).toISOString();
};
const iso = (value) =>
  typeof value === 'string' && Number.isFinite(Date.parse(value))
    ? new Date(Date.parse(value)).toISOString()
    : null;
const string = (value) => (typeof value === 'string' && value.trim() ? value.trim() : null);
const number = (value) => (typeof value === 'number' && Number.isFinite(value) ? value : null);
const record = (value) =>
  value && typeof value === 'object' && !Array.isArray(value) ? value : {};
const strings = (value) =>
  Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : [];
const unique = (values) => [...new Set(values.map((value) => value.trim()).filter(Boolean))];

module.exports = {
  clean,
  clientFor,
  createSubscription,
  deleteSubscription,
  processWebhook,
};
